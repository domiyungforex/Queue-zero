import "server-only";
import { z } from "zod";
import { parseAssignmentFromText, type SmartAssignmentExtraction } from "@/lib/academic/ingestion";
import { ASSIGNMENT_CATEGORIES, QUESTION_TYPES } from "@/lib/academic/types";

export const MISTRAL_OCR_MODEL = "mistral-ocr-latest";
export const MISTRAL_TEXT_MODEL = "mistral-small-latest";

export function isMistralConfigured(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY?.trim());
}

function getMistralKey(): string {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) {
    throw new Error("Mistral AI is not configured. Set MISTRAL_API_KEY on the server.");
  }
  return key;
}

const ocrResponseSchema = z.object({
  pages: z
    .array(
      z.object({
        index: z.number().optional(),
        markdown: z.string().default(""),
      }),
    )
    .default([]),
});

export async function runMistralOcr(input: {
  buffer: Buffer;
  mimeType: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let key: string;
  try {
    key = getMistralKey();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mistral AI is not configured." };
  }

  const base64 = input.buffer.toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64}`;
  const isPdf = input.mimeType === "application/pdf";

  const body = {
    model: MISTRAL_OCR_MODEL,
    document: isPdf
      ? { type: "document_url", document_url: dataUrl }
      : { type: "image_url", image_url: dataUrl },
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });

      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Mistral AI authentication failed. Check server MISTRAL_API_KEY configuration." };
      }
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        continue;
      }
      if (!res.ok) {
        return { ok: false, error: "Mistral OCR could not process this document. You can still edit manually." };
      }

      const json: unknown = await res.json();
      const parsed = ocrResponseSchema.safeParse(json);
      if (!parsed.success) {
        return { ok: false, error: "Mistral OCR returned an unexpected format." };
      }
      const markdown = parsed.data.pages
        .map((p) => p.markdown.trim())
        .filter(Boolean)
        .join("\n\n");

      return { ok: true, text: markdown };
    } catch {
      if (attempt === 1) {
        return { ok: false, error: "Mistral OCR request timed out or was interrupted." };
      }
    }
  }
  return { ok: false, error: "Mistral OCR unavailable." };
}

const aiExtractionSchema = z.object({
  title: z.string().optional().default(""),
  courseCode: z.string().nullable().optional().default(null),
  category: z.enum(ASSIGNMENT_CATEGORIES).optional().default("HOMEWORK"),
  instructions: z.string().optional().default(""),
  learningObjectives: z.string().optional().default(""),
  dueAt: z.string().nullable().optional().default(null),
  questions: z
    .array(
      z.object({
        questionType: z.enum(QUESTION_TYPES).optional().default("SHORT_ANSWER"),
        prompt: z.string().min(1),
        options: z.array(z.string()).optional().default([]),
        marks: z.number().min(0).max(1000).optional().default(10),
        formulaLatex: z.string().optional().default(""),
        uncertain: z.boolean().optional().default(false),
      }),
    )
    .default([]),
});

export async function extractAssignmentWithMistralSmall(input: {
  text: string;
  authorizedCourses: Array<{ id: string; code: string; title: string }>;
}): Promise<{ ok: true; extraction: SmartAssignmentExtraction } | { ok: false; error: string }> {
  let key: string;
  try {
    key = getMistralKey();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mistral AI is not configured." };
  }

  const courseList = input.authorizedCourses.map((c) => `${c.code}: ${c.title}`).join("\n");
  const systemPrompt = [
    "You extract university assignment details into strict JSON.",
    "NEVER invent missing deadlines, course codes, or questions. If a deadline is not explicitly stated, set dueAt to null.",
    "Match courseCode ONLY from the authorized courses list if clearly present; otherwise null.",
    "Return JSON with keys: title, courseCode, category (one of HOMEWORK,CLASSWORK,TAKE_HOME,INDIVIDUAL_PROJECT,GROUP_PROJECT,PRACTICAL,LAB_REPORT,RESEARCH_PAPER,ESSAY,CONTINUOUS_ASSESSMENT,EXAM,OTHER), instructions, learningObjectives, dueAt, questions (array of {questionType, prompt, options, marks, formulaLatex, uncertain}).",
  ].join(" ");

  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MISTRAL_TEXT_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Authorized courses:\n${courseList || "None"}\n\nDocument text:\n${input.text.slice(0, 16000)}`,
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Mistral AI authentication failed. Check server MISTRAL_API_KEY configuration." };
    }
    if (!res.ok) {
      return { ok: false, error: "Mistral text extraction unavailable. Falling back to local parser." };
    }

    const envelope = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = envelope.choices?.[0]?.message?.content;
    if (!rawContent) {
      return { ok: false, error: "Mistral returned an empty response." };
    }

    const parsed = aiExtractionSchema.safeParse(JSON.parse(rawContent));
    if (!parsed.success) {
      return { ok: false, error: "Mistral output did not match assignment schema." };
    }

    const d = parsed.data;
    const matchedCourse = d.courseCode
      ? input.authorizedCourses.find(
          (c) => c.code.toLowerCase() === d.courseCode!.trim().toLowerCase(),
        ) ?? null
      : null;

    const totalMarks =
      d.questions.length > 0 ? d.questions.reduce((sum, q) => sum + q.marks, 0) : null;

    const missingFields: string[] = [];
    if (!matchedCourse) missingFields.push("Course (select an authorized course)");
    if (!d.dueAt) missingFields.push("Submission deadline (not found in document — please confirm)");

    const warnings: string[] = [];
    if (d.questions.some((q) => q.uncertain)) {
      warnings.push("Some extracted questions were marked uncertain; please review before publishing.");
    }

    return {
      ok: true,
      extraction: {
        title: d.title,
        matchedCourseId: matchedCourse?.id ?? null,
        matchedCourseCode: matchedCourse?.code ?? null,
        category: d.category,
        instructions: d.instructions,
        learningObjectives: d.learningObjectives,
        dueAt: d.dueAt,
        questions: d.questions,
        totalMarks,
        missingFields,
        warnings,
        fieldSources: {
          title: d.title ? "EXTRACTED" : "MISSING",
          course: matchedCourse ? "INSTITUTIONAL" : "MISSING",
          category: "SUGGESTED",
          dueAt: d.dueAt ? "EXTRACTED" : "MISSING",
          questions: d.questions.length > 0 ? "EXTRACTED" : "MISSING",
        },
      },
    };
  } catch {
    return {
      ok: true,
      extraction: parseAssignmentFromText(input.text, input.authorizedCourses),
    };
  }
}
