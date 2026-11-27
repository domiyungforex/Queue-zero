import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseAssignmentFromText, type SmartAssignmentExtraction } from "@/lib/academic/ingestion";
import { ASSIGNMENT_CATEGORIES, QUESTION_TYPES } from "@/lib/academic/types";
import { getAnthropicMarkingModel, getAnthropicModel, isAnthropicConfigured } from "./provider";

export interface AiUsageMetrics {
  provider: "anthropic";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const claudeExtractionSchema = z.object({
  title: z.string().optional().default(""),
  courseCode: z.string().nullable().optional().default(null),
  courseName: z.string().nullable().optional().default(null),
  category: z.enum(ASSIGNMENT_CATEGORIES).optional().default("HOMEWORK"),
  instructions: z.string().optional().default(""),
  learningObjectives: z.string().optional().default(""),
  dueAt: z.string().nullable().optional().default(null),
  totalMarks: z.number().min(0).max(10000).nullable().optional().default(null),
  submissionRequirements: z.string().optional().default(""),
  questions: z
    .array(
      z.object({
        questionType: z.enum(QUESTION_TYPES).optional().default("SHORT_ANSWER"),
        prompt: z.string().min(1),
        options: z.array(z.string()).optional().default([]),
        marks: z.number().min(0).max(1000).optional().default(10),
        formulaLatex: z.string().optional().default(""),
        modelAnswer: z.string().optional().default(""),
        uncertain: z.boolean().optional().default(false),
      }),
    )
    .default([]),
});

const claudeMarkingSchema = z.object({
  suggestedMarks: z.number().min(0),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  explanation: z.string().min(1),
  criteriaSatisfied: z.array(z.string()).default([]),
  criteriaMissing: z.array(z.string()).default([]),
  requiresLecturerReview: z.boolean().default(true),
});

const claudeQuestionGenSchema = z.object({
  questions: z
    .array(
      z.object({
        questionType: z.enum(QUESTION_TYPES).default("SHORT_ANSWER"),
        prompt: z.string().min(1),
        options: z.array(z.string()).default([]),
        marks: z.number().min(1).max(100).default(10),
        formulaLatex: z.string().default(""),
        acceptedAnswers: z.array(z.string()).default([]),
        modelAnswer: z.string().default(""),
        markingGuide: z.string().default(""),
      }),
    )
    .min(1),
});

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TuRnMaRk AI is not configured on the server.");
  }
  return new Anthropic({
    apiKey,
    timeout: 25_000,
    maxRetries: 0, // Managed explicitly below with bounded exponential backoff
  });
}

function classifyAnthropicError(err: unknown): { message: string; retryable: boolean } {
  if (err && typeof err === "object") {
    const status = "status" in err ? Number((err as { status?: number }).status) : undefined;
    const name = "name" in err ? String((err as { name?: string }).name) : "";
    if (status === 401 || status === 403) {
      return {
        message: "TuRnMaRk AI authentication failed. Check server AI configuration.",
        retryable: false,
      };
    }
    if (status === 429) {
      return {
        message: "TuRnMaRk AI is busy right now. Please retry shortly or complete manually.",
        retryable: true,
      };
    }
    if (status && status >= 500) {
      return {
        message: "TuRnMaRk AI is temporarily unavailable.",
        retryable: true,
      };
    }
    if (name === "APIConnectionTimeoutError" || name === "AbortError") {
      return {
        message: "TuRnMaRk AI request timed out.",
        retryable: true,
      };
    }
  }
  return {
    message: "TuRnMaRk AI could not complete processing. You can continue manually.",
    retryable: false,
  };
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const classified = classifyAnthropicError(err);
      if (!classified.retryable || attempt === 2) {
        throw err;
      }
      const delayMs = 400 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

function extractJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function normalizeExtractedAssignment(
  raw: z.infer<typeof claudeExtractionSchema>,
  authorizedCourses: Array<{ id: string; code: string; title: string }>,
  fallbackText: string,
): SmartAssignmentExtraction {
  const base = parseAssignmentFromText(fallbackText || raw.instructions || raw.title, authorizedCourses);
  const codeNorm = raw.courseCode?.replace(/\s+/g, "").toLowerCase() ?? "";
  const matchedCourse = codeNorm
    ? authorizedCourses.find((c) => c.code.replace(/\s+/g, "").toLowerCase() === codeNorm) ?? null
    : base.matchedCourseId
      ? authorizedCourses.find((c) => c.id === base.matchedCourseId) ?? null
      : null;

  const missingFields: string[] = [];
  if (!raw.title && !base.title) missingFields.push("Assignment title");
  if (!matchedCourse && !raw.courseCode && !raw.courseName) {
    missingFields.push("Course (select an existing course or enter manually)");
  }
  if (!raw.dueAt) missingFields.push("Submission deadline (optional — not stated in document)");
  if (raw.questions.length === 0) missingFields.push("Questions");

  const warnings: string[] = [];
  if (raw.questions.some((q) => q.uncertain)) {
    warnings.push("Some extracted questions were marked uncertain — review before publishing.");
  }
  if (!matchedCourse && (raw.courseCode || raw.courseName)) {
    warnings.push(
      `Extracted course "${[raw.courseCode, raw.courseName].filter(Boolean).join(" — ")}" is not in the catalog; prefilled as manual course.`,
    );
  }

  const mappedQuestions =
    raw.questions.length > 0
      ? raw.questions.map((q) => ({
          questionType: q.questionType,
          prompt: q.prompt,
          options: q.options,
          marks: q.marks,
          formulaLatex: q.formulaLatex,
          uncertain: q.uncertain,
        }))
      : base.questions;

  const computedTotalMarks =
    raw.totalMarks ??
    (mappedQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0) || base.totalMarks);

  return {
    title: raw.title || base.title,
    matchedCourseId: matchedCourse?.id ?? null,
    matchedCourseCode: matchedCourse?.code ?? raw.courseCode ?? null,
    category: raw.category ?? base.category,
    instructions: raw.instructions || base.instructions,
    learningObjectives: raw.learningObjectives || base.learningObjectives,
    dueAt: raw.dueAt || null,
    totalMarks: computedTotalMarks,
    questions: mappedQuestions,
    warnings,
    missingFields,
    fieldSources: {
      title: raw.title ? "EXTRACTED" : base.fieldSources.title,
      course: matchedCourse ? "INSTITUTIONAL" : raw.courseCode || raw.courseName ? "EXTRACTED" : "MISSING",
      dueAt: raw.dueAt ? "EXTRACTED" : "MISSING",
      questions: mappedQuestions.length > 0 ? "EXTRACTED" : "MISSING",
    },
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You extract structured university/school assignment data for TuRnMaRk.
Return ONLY valid JSON with keys:
{
  "title": string,
  "courseCode": string | null,
  "courseName": string | null,
  "category": "HOMEWORK"|"CLASSWORK"|"TAKE_HOME"|"INDIVIDUAL_PROJECT"|"GROUP_PROJECT"|"PRACTICAL"|"LAB_REPORT"|"RESEARCH_PAPER"|"ESSAY"|"CONTINUOUS_ASSESSMENT"|"EXAM"|"OTHER",
  "instructions": string,
  "learningObjectives": string,
  "dueAt": string | null (ISO 8601 ONLY if explicitly stated; otherwise null),
  "totalMarks": number | null,
  "submissionRequirements": string,
  "questions": [
    {
      "questionType": "MCQ"|"TRUE_FALSE"|"SHORT_ANSWER"|"LONG_ANSWER"|"ESSAY"|"MATH"|"PRACTICAL_FILE"|"MATCHING"|"FILL_GAP",
      "prompt": string,
      "options": string[],
      "marks": number,
      "formulaLatex": string,
      "modelAnswer": string,
      "uncertain": boolean
    }
  ]
}
Strict rules:
- Never invent missing deadlines, course codes, or questions.
- Preserve mathematical/scientific notation in prompt or formulaLatex.
- Set uncertain=true if handwriting/scan quality makes a question ambiguous.`;

export async function extractAssignmentFromTextWithClaude(input: {
  text: string;
  authorizedCourses: Array<{ id: string; code: string; title: string }>;
}): Promise<
  | { ok: true; extraction: SmartAssignmentExtraction; usage: AiUsageMetrics }
  | { ok: false; error: string }
> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: "TuRnMaRk AI is not configured on the server." };
  }
  const model = getAnthropicModel();
  try {
    const client = createAnthropicClient();
    const courseList = input.authorizedCourses.map((c) => `${c.code}: ${c.title}`).join(", ");
    const msg = await withBackoff(() =>
      client.messages.create({
        model,
        max_tokens: 2400,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Authorized courses: ${courseList || "None"}\n\nAssignment text:\n${input.text.slice(0, 24_000)}`,
          },
        ],
      }),
    );

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Claude returned no structured text output." };
    }
    const parsed = claudeExtractionSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "Claude returned incomplete extraction output; please review manually." };
    }

    return {
      ok: true,
      extraction: normalizeExtractedAssignment(parsed.data, input.authorizedCourses, input.text),
      usage: {
        provider: "anthropic",
        model,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      },
    };
  } catch (err) {
    return { ok: false, error: classifyAnthropicError(err).message };
  }
}

export async function extractAssignmentFromDocumentWithClaude(input: {
  buffer: Buffer;
  mimeType: string;
  authorizedCourses: Array<{ id: string; code: string; title: string }>;
}): Promise<
  | { ok: true; extraction: SmartAssignmentExtraction; usage: AiUsageMetrics }
  | { ok: false; error: string }
> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: "TuRnMaRk AI is not configured on the server." };
  }
  const model = getAnthropicModel();
  const base64 = input.buffer.toString("base64");
  const courseList = input.authorizedCourses.map((c) => `${c.code}: ${c.title}`).join(", ");

  const mediaBlock =
    input.mimeType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        } as const)
      : ({
          type: "image",
          source: {
            type: "base64",
            media_type: input.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64,
          },
        } as const);

  try {
    const client = createAnthropicClient();
    const msg = await withBackoff(() =>
      client.messages.create({
        model,
        max_tokens: 2800,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              mediaBlock,
              {
                type: "text",
                text: `Extract the assignment from this document/image. Authorized courses: ${courseList || "None"}. Return ONLY valid JSON.`,
              },
            ],
          },
        ],
      }),
    );

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Claude could not read structured content from this document." };
    }
    const parsed = claudeExtractionSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "Claude returned partial extraction; please review manually." };
    }

    return {
      ok: true,
      extraction: normalizeExtractedAssignment(parsed.data, input.authorizedCourses, parsed.data.instructions),
      usage: {
        provider: "anthropic",
        model,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      },
    };
  } catch (err) {
    return { ok: false, error: classifyAnthropicError(err).message };
  }
}

export async function evaluateSubjectiveAnswerWithClaude(input: {
  questionPrompt: string;
  maxMarks: number;
  modelAnswer?: string | null;
  rubricCriteria?: string[];
  studentResponse: string;
}): Promise<
  | {
      ok: true;
      suggestedMarks: number;
      confidence: "HIGH" | "MEDIUM" | "LOW";
      explanation: string;
      criteriaSatisfied: string[];
      criteriaMissing: string[];
      requiresLecturerReview: boolean;
      usage: AiUsageMetrics;
    }
  | { ok: false; error: string }
> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: "Anthropic Claude is not configured." };
  }
  if (!input.studentResponse.trim()) {
    return {
      ok: true,
      suggestedMarks: 0,
      confidence: "HIGH",
      explanation: "No answer submitted.",
      criteriaSatisfied: [],
      criteriaMissing: ["Response required"],
      requiresLecturerReview: false,
      usage: { provider: "anthropic", model: getAnthropicMarkingModel(), inputTokens: 0, outputTokens: 0 },
    };
  }

  const model = getAnthropicMarkingModel();
  try {
    const client = createAnthropicClient();
    const msg = await withBackoff(() =>
      client.messages.create({
        model,
        max_tokens: 900,
        system: `You are an academic marking assistant for TuRnMaRk. Your marks are strictly SUGGESTIONS for the lecturer.
Return ONLY valid JSON:
{
  "suggestedMarks": number (between 0 and maxMarks),
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "explanation": string (constructive feedback explaining reasoning),
  "criteriaSatisfied": string[],
  "criteriaMissing": string[],
  "requiresLecturerReview": boolean
}`,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              questionPrompt: input.questionPrompt,
              maxMarks: input.maxMarks,
              modelAnswer: input.modelAnswer ?? "",
              rubricCriteria: input.rubricCriteria ?? [],
              studentResponse: input.studentResponse.slice(0, 8000),
            }),
          },
        ],
      }),
    );

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Claude returned no marking output." };
    }
    const parsed = claudeMarkingSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "Claude marking output could not be parsed." };
    }

    const boundedMarks = Math.min(input.maxMarks, Math.max(0, Math.round(parsed.data.suggestedMarks * 100) / 100));
    return {
      ok: true,
      suggestedMarks: boundedMarks,
      confidence: parsed.data.confidence,
      explanation: parsed.data.explanation,
      criteriaSatisfied: parsed.data.criteriaSatisfied,
      criteriaMissing: parsed.data.criteriaMissing,
      requiresLecturerReview: parsed.data.requiresLecturerReview,
      usage: {
        provider: "anthropic",
        model,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      },
    };
  } catch (err) {
    return { ok: false, error: classifyAnthropicError(err).message };
  }
}

export async function generateQuestionsWithClaude(input: {
  topic: string;
  courseCode?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
  questionTypes: Array<(typeof QUESTION_TYPES)[number]>;
}): Promise<
  | {
      ok: true;
      questions: z.infer<typeof claudeQuestionGenSchema>["questions"];
      usage: AiUsageMetrics;
    }
  | { ok: false; error: string }
> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: "Anthropic Claude is not configured." };
  }
  const model = getAnthropicModel();
  try {
    const client = createAnthropicClient();
    const msg = await withBackoff(() =>
      client.messages.create({
        model,
        max_tokens: 2400,
        system: `Generate academic assessment questions for TuRnMaRk. Separate student-facing prompts/options from answer keys and marking guides.
Return ONLY valid JSON:
{
  "questions": [
    {
      "questionType": "MCQ"|"TRUE_FALSE"|"SHORT_ANSWER"|"LONG_ANSWER"|"ESSAY"|"MATH",
      "prompt": string,
      "options": string[],
      "marks": number,
      "formulaLatex": string,
      "acceptedAnswers": string[],
      "modelAnswer": string,
      "markingGuide": string
    }
  ]
}`,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              topic: input.topic,
              courseCode: input.courseCode ?? "",
              difficulty: input.difficulty,
              count: Math.min(20, Math.max(1, input.count)),
              questionTypes: input.questionTypes,
            }),
          },
        ],
      }),
    );

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Claude returned no generated questions." };
    }
    const parsed = claudeQuestionGenSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "Claude returned invalid question generation format." };
    }

    return {
      ok: true,
      questions: parsed.data.questions,
      usage: {
        provider: "anthropic",
        model,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      },
    };
  } catch (err) {
    return { ok: false, error: classifyAnthropicError(err).message };
  }
}
