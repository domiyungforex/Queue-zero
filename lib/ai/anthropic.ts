import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseAssignmentFromText, type SmartAssignmentExtraction } from "@/lib/academic/ingestion";
import { ASSIGNMENT_CATEGORIES, QUESTION_TYPES, type AssignmentCategory, type QuestionType } from "@/lib/academic/types";
import { getAnthropicMarkingModel, getAnthropicModel, isAnthropicConfigured } from "./provider";

export interface AiUsageMetrics {
  provider: "anthropic";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const nullToEmpty = z
  .string()
  .nullish()
  .transform((v) => (v ?? "").trim());

function normalizeCategory(raw: unknown): AssignmentCategory {
  if (typeof raw !== "string") return "HOMEWORK";
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((ASSIGNMENT_CATEGORIES as readonly string[]).includes(upper)) {
    return upper as AssignmentCategory;
  }
  if (upper.includes("EXAM") || upper.includes("TEST")) return "EXAM";
  if (upper.includes("QUIZ") || upper.includes("CA")) return "CONTINUOUS_ASSESSMENT";
  if (upper.includes("LAB")) return "LAB_REPORT";
  if (upper.includes("ESSAY")) return "ESSAY";
  if (upper.includes("PROJECT")) return "INDIVIDUAL_PROJECT";
  if (upper.includes("PRACTICAL")) return "PRACTICAL";
  return "HOMEWORK";
}

function normalizeQuestionType(raw: unknown): QuestionType {
  if (typeof raw !== "string") return "SHORT_ANSWER";
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((QUESTION_TYPES as readonly string[]).includes(upper)) {
    return upper as QuestionType;
  }
  if (upper.includes("MCQ") || upper.includes("MULTIPLE") || upper.includes("CHOICE")) return "MCQ";
  if (upper.includes("TRUE") || upper.includes("FALSE") || upper.includes("BOOL")) return "TRUE_FALSE";
  if (upper.includes("ESSAY")) return "ESSAY";
  if (upper.includes("LONG") || upper.includes("THEORY") || upper.includes("DERIV")) return "LONG_ANSWER";
  if (upper.includes("MATH") || upper.includes("CALC") || upper.includes("NUMER")) return "MATH";
  if (upper.includes("FILL") || upper.includes("GAP") || upper.includes("BLANK")) return "FILL_GAP";
  if (upper.includes("MATCH")) return "MATCHING";
  return "SHORT_ANSWER";
}

const rawQuestionSchema = z.object({
  questionType: z.unknown().optional(),
  prompt: z.string().nullish(),
  options: z.array(z.unknown()).nullish(),
  marks: z.union([z.number(), z.string()]).nullish(),
  formulaLatex: nullToEmpty,
  modelAnswer: nullToEmpty,
  uncertain: z.boolean().nullish(),
});

const claudeExtractionEnvelopeSchema = z.object({
  title: nullToEmpty,
  courseCode: z.string().nullish().transform((v) => (v && v.trim() ? v.trim() : null)),
  courseName: z.string().nullish().transform((v) => (v && v.trim() ? v.trim() : null)),
  category: z.unknown().optional(),
  instructions: nullToEmpty,
  learningObjectives: nullToEmpty,
  dueAt: z.string().nullish().transform((v) => (v && v.trim() ? v.trim() : null)),
  totalMarks: z.union([z.number(), z.string()]).nullish(),
  submissionRequirements: nullToEmpty,
  questions: z.array(z.unknown()).nullish().transform((v) => v ?? []),
});

const claudeMarkingSchema = z.object({
  suggestedMarks: z.number().min(0),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  explanation: z.string().min(1),
  criteriaSatisfied: z.array(z.string()).nullish().transform((v) => v ?? []),
  criteriaMissing: z.array(z.string()).nullish().transform((v) => v ?? []),
  requiresLecturerReview: z.boolean().nullish().transform((v) => v ?? true),
});

const claudeQuestionGenSchema = z.object({
  questions: z
    .array(
      z.object({
        questionType: z.unknown().transform(normalizeQuestionType),
        prompt: z.string().min(1),
        options: z.array(z.string()).nullish().transform((v) => v ?? []),
        marks: z.number().min(1).max(100).nullish().transform((v) => v ?? 10),
        formulaLatex: nullToEmpty,
        acceptedAnswers: z.array(z.string()).nullish().transform((v) => v ?? []),
        modelAnswer: nullToEmpty,
        markingGuide: nullToEmpty,
      }),
    )
    .min(1),
});

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TuRnMaRk AI is temporarily unavailable. You can continue creating your assignment manually.");
  }
  return new Anthropic({
    apiKey,
    timeout: 25_000,
    maxRetries: 0,
  });
}

function classifyAnthropicError(err: unknown): { message: string; retryable: boolean } {
  if (err && typeof err === "object") {
    const status = "status" in err ? Number((err as { status?: number }).status) : undefined;
    const name = "name" in err ? String((err as { name?: string }).name) : "";
    if (status === 401 || status === 403) {
      return {
        message: "TuRnMaRk AI is temporarily unavailable. Please contact your institution administrator or continue manually.",
        retryable: false,
      };
    }
    if (status === 429) {
      return {
        message: "TuRnMaRk AI is busy right now. Your original document is safe — please try again shortly or continue manually.",
        retryable: true,
      };
    }
    if (status && status >= 500) {
      return {
        message: "TuRnMaRk AI is temporarily unavailable. Your original document is safe.",
        retryable: true,
      };
    }
    if (name === "APIConnectionTimeoutError" || name === "AbortError") {
      return {
        message: "Document processing timed out. Your original document is safe — please retry or enter questions manually.",
        retryable: true,
      };
    }
  }
  return {
    message: "Something interrupted document processing. Your original document is safe. Please try again or enter questions manually.",
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
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

function normalizeExtractedAssignment(
  raw: z.infer<typeof claudeExtractionEnvelopeSchema>,
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

  // Validate each question individually so 1 malformed item never discards the rest
  const validQuestions: SmartAssignmentExtraction["questions"] = [];
  let droppedQuestions = 0;
  for (const item of raw.questions) {
    const qParsed = rawQuestionSchema.safeParse(item);
    if (!qParsed.success || !qParsed.data.prompt?.trim()) {
      droppedQuestions += 1;
      continue;
    }
    const q = qParsed.data;
    const qPrompt = (q.prompt ?? "").trim();
    if (!qPrompt) {
      droppedQuestions += 1;
      continue;
    }
    const numericMarks = Number(q.marks);
    const marks = Number.isFinite(numericMarks) && numericMarks >= 0 && numericMarks <= 1000 ? numericMarks : 10;
    validQuestions.push({
      questionType: normalizeQuestionType(q.questionType),
      prompt: qPrompt,
      options: (q.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean),
      marks,
      formulaLatex: q.formulaLatex,
      uncertain: Boolean(q.uncertain),
    });
  }

  const mappedQuestions = validQuestions.length > 0 ? validQuestions : base.questions;

  const missingFields: string[] = [];
  if (!raw.title && !base.title) missingFields.push("Assignment title");
  if (mappedQuestions.length === 0) missingFields.push("Questions");

  const warnings: string[] = [];
  if (droppedQuestions > 0) {
    warnings.push("We extracted some of your assignment content. A few sections may need your attention.");
  }
  if (mappedQuestions.some((q) => q.uncertain)) {
    warnings.push("Some extracted questions were flagged for your review before publishing.");
  }
  if (!matchedCourse && (raw.courseCode || raw.courseName)) {
    warnings.push(
      `Extracted course "${[raw.courseCode, raw.courseName].filter(Boolean).join(" — ")}" was prefilled as a manual course.`,
    );
  }

  const parsedTotalMarks = Number(raw.totalMarks);
  const computedTotalMarks =
    Number.isFinite(parsedTotalMarks) && parsedTotalMarks > 0
      ? parsedTotalMarks
      : mappedQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0) || base.totalMarks;

  return {
    title: raw.title || base.title,
    matchedCourseId: matchedCourse?.id ?? null,
    matchedCourseCode: matchedCourse?.code ?? raw.courseCode ?? null,
    category: normalizeCategory(raw.category),
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
- Extract every visible question and subquestion accurately, preserving numbering and wording.
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
    return {
      ok: false,
      error: "TuRnMaRk AI is not configured. Please contact your institution administrator or continue manually.",
    };
  }
  const model = getAnthropicModel();
  try {
    const client = createAnthropicClient();
    const courseList = input.authorizedCourses.map((c) => `${c.code}: ${c.title}`).join(", ");
    const msg = await withBackoff(() =>
      client.messages.create({
        model,
        max_tokens: 4096,
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
      return { ok: false, error: "We couldn't identify assignment questions in this document. Try a clearer document or add your questions manually." };
    }
    const parsed = claudeExtractionEnvelopeSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "TuRnMaRk could not extract all assignment questions. Please review or add questions manually." };
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
    return {
      ok: false,
      error: "TuRnMaRk AI is not configured. Please contact your institution administrator or continue manually.",
    };
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
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              mediaBlock,
              {
                type: "text",
                text: `Extract all assignment details and questions from this document/image. Authorized courses: ${courseList || "None"}. Return ONLY valid JSON.`,
              },
            ],
          },
        ],
      }),
    );

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "We couldn't identify assignment questions in this document. Try a clearer document or add your questions manually." };
    }
    const parsed = claudeExtractionEnvelopeSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "TuRnMaRk could not extract all assignment questions. Please review or add questions manually." };
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

function subjectDomainGuidance(domain?: string): string {
  switch (domain) {
    case "MATHEMATICS_PHYSICS":
      return "Subject domain: Mathematics & Physics. Assess formula selection, step-by-step workings, equivalent mathematical expressions, numerical accuracy, units, and significant figures. Award partial credit for valid method steps even if a final arithmetic slip occurs.";
    case "ENGINEERING":
      return "Subject domain: Engineering. Assess technical reasoning, design decisions, calculations, units, standards, and practical correctness. Flag complex CAD/technical drawings for lecturer review if visual inspection is insufficient.";
    case "COMPUTER_SCIENCE":
      return "Subject domain: Computer Science. Assess algorithmic reasoning, code correctness, edge-case handling, time/space complexity, and output accuracy rather than minor syntax style.";
    case "HUMANITIES_SOCIAL":
      return "Subject domain: Humanities & Social Sciences. Assess argument quality, supporting evidence, relevance to prompt, critical reasoning, structure, and referencing.";
    case "FINE_ART_DESIGN":
      return "Subject domain: Fine Art & Design. Assess against lecturer-defined criteria, composition, technique, execution, originality, and supporting artist/design explanations. Flag visual studio work for lecturer review.";
    default:
      return "Subject domain: General Academic. Assess accuracy, completeness, reasoning, and adherence to the lecturer's rubric.";
  }
}

export async function evaluateSubjectiveAnswerWithClaude(input: {
  questionPrompt: string;
  maxMarks: number;
  modelAnswer?: string | null;
  rubricCriteria?: string[];
  markingInstructions?: string | null;
  assignmentInstructions?: string | null;
  subjectDomain?: string;
  studentResponse: string;
  attachments?: Array<{ fileName: string; mimeType: string; buffer: Buffer }>;
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
    return { ok: false, error: "TuRnMaRk AI is temporarily unavailable." };
  }
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  if (!input.studentResponse.trim() && !hasAttachments) {
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
    const contentBlocks: Anthropic.ContentBlockParam[] = [
      {
        type: "text",
        text: JSON.stringify({
          questionPrompt: input.questionPrompt,
          maxMarks: input.maxMarks,
          assignmentInstructions: input.assignmentInstructions ?? "",
          lecturerMarkingInstructions: input.markingInstructions ?? "",
          modelAnswer: input.modelAnswer ?? "",
          rubricCriteria: input.rubricCriteria ?? [],
          studentResponse: input.studentResponse.slice(0, 8000),
          attachedFiles: (input.attachments ?? []).map((a) => a.fileName),
        }),
      },
    ];

    for (const att of (input.attachments ?? []).slice(0, 4)) {
      const mime = att.mimeType.toLowerCase();
      if (mime === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: att.buffer.toString("base64"),
          },
        });
      } else if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/gif") {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mime,
            data: att.buffer.toString("base64"),
          },
        });
      } else if (mime.startsWith("text/")) {
        contentBlocks.push({
          type: "text",
          text: `Attached file (${att.fileName}):\n${att.buffer.toString("utf8").slice(0, 6000)}`,
        });
      }
    }

    const msg = await withBackoff(() =>
      client.messages.create({
        model,
        max_tokens: 1100,
        system: `You are an academic marking assistant for TuRnMaRk. Your marks are strictly SUGGESTIONS for the lecturer.
${subjectDomainGuidance(input.subjectDomain)}
Rules:
- Lecturer's explicit marking instructions and rubric always take priority.
- Accept valid alternative approaches and equivalent mathematical/scientific expressions; never require word-for-word reproduction.
- Award partial marks fairly when partial reasoning or steps are correct.
- Never invent student responses or fabricate assessment evidence.
- Set requiresLecturerReview=true if handwriting/scan is ambiguous, a file is unreadable, or complex diagrams/technical files need human inspection.
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
            content: contentBlocks,
          },
        ],
      }),
    );

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "TuRnMaRk AI returned no marking suggestion." };
    }
    const parsed = claudeMarkingSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "TuRnMaRk AI marking suggestion could not be parsed." };
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
    return { ok: false, error: "TuRnMaRk AI is temporarily unavailable." };
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
      return { ok: false, error: "TuRnMaRk AI could not generate questions right now." };
    }
    const parsed = claudeQuestionGenSchema.safeParse(extractJsonObject(textBlock.text));
    if (!parsed.success) {
      return { ok: false, error: "TuRnMaRk AI returned an incomplete question set." };
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
