import { z } from "zod";

export const ASSIGNMENT_CATEGORIES = [
  "HOMEWORK",
  "CLASSWORK",
  "TAKE_HOME",
  "INDIVIDUAL_PROJECT",
  "GROUP_PROJECT",
  "PRACTICAL",
  "LAB_REPORT",
  "RESEARCH_PAPER",
  "ESSAY",
  "CONTINUOUS_ASSESSMENT",
  "EXAM",
  "OTHER",
] as const;

export type AssignmentCategory = (typeof ASSIGNMENT_CATEGORIES)[number];

export const QUESTION_TYPES = [
  "MCQ",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "ESSAY",
  "MATH",
  "PRACTICAL_FILE",
  "MATCHING",
  "FILL_GAP",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const MARKING_MODES = ["AUTO_OBJECTIVE", "MANUAL", "AI_ASSISTED", "HYBRID"] as const;
export type MarkingMode = (typeof MARKING_MODES)[number];

export const LATE_POLICIES = ["BLOCK", "ALLOW_WITH_FLAG", "ALLOW_PENALTY"] as const;
export type LatePolicy = (typeof LATE_POLICIES)[number];

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().default(""),
  instructions: z.string().trim().max(10000).optional().default(""),
  learningObjectives: z.string().trim().max(2000).optional().default(""),
  courseId: z.uuid(),
  academicSession: z.string().trim().max(80).optional().default(""),
  semester: z.string().trim().max(40).optional().default(""),
  classGroup: z.string().trim().max(80).optional().default(""),
  category: z.enum(ASSIGNMENT_CATEGORIES).default("HOMEWORK"),
  opensAt: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable(),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  latePolicy: z.enum(LATE_POLICIES).default("ALLOW_WITH_FLAG"),
  latePenaltyPercent: z.number().int().min(0).max(100).default(0),
  allowedFormats: z.array(z.string()).min(1).default(["TEXT", "PDF", "IMAGE", "CAMERA"]),
  maxUploadMb: z.number().int().min(1).max(50).default(10),
  submissionMode: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
  allowTextAnswer: z.boolean().default(true),
  allowFileUpload: z.boolean().default(true),
  allowPhotoSubmission: z.boolean().default(true),
  allowEditAfterSubmit: z.boolean().default(false),
  allowResubmission: z.boolean().default(false),
  markingMode: z.enum(MARKING_MODES).default("HYBRID"),
  totalMarks: z.number().positive().max(10000).default(100),
  releaseMarksImmediately: z.boolean().default(false),
  publishNow: z.boolean().default(false),
  questions: z
    .array(
      z.object({
        questionType: z.enum(QUESTION_TYPES),
        prompt: z.string().trim().min(1).max(10000),
        description: z.string().trim().max(2000).optional().default(""),
        formulaLatex: z.string().trim().max(1000).optional().default(""),
        options: z.array(z.string()).default([]),
        marks: z.number().min(0).max(1000).default(10),
        negativeMarks: z.number().min(0).max(100).default(0),
        partialCredit: z.boolean().default(false),
        acceptedAnswers: z.array(z.string()).default([]),
        modelAnswer: z.string().trim().max(5000).optional().default(""),
        expectedFormula: z.string().trim().max(1000).optional().default(""),
        expectedUnit: z.string().trim().max(40).optional().default(""),
        numericTolerance: z.number().min(0).max(10000).default(0),
        caseSensitive: z.boolean().default(false),
      }),
    )
    .min(1),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
