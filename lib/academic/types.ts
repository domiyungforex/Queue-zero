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

export const ASSIGNMENT_TARGET_AUDIENCES = [
  "ALL_INSTITUTION",
  "COURSE_ENROLLED",
  "CLASS_ATTENDEES",
  "DEPARTMENT_LEVEL",
] as const;
export type AssignmentTargetAudience = (typeof ASSIGNMENT_TARGET_AUDIENCES)[number];

export const ATTACHMENT_ROLES = ["ASSIGNMENT_MAIN", "REFERENCE", "LECTURER_ONLY"] as const;
export type AttachmentRole = (typeof ATTACHMENT_ROLES)[number];

export const SUBJECT_DOMAINS = [
  "GENERAL",
  "MATHEMATICS_PHYSICS",
  "ENGINEERING",
  "COMPUTER_SCIENCE",
  "HUMANITIES_SOCIAL",
  "FINE_ART_DESIGN",
] as const;
export type SubjectDomain = (typeof SUBJECT_DOMAINS)[number];

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v ?? "");

const optionalTimestampString = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

export const assignmentQuestionInputSchema = z.object({
  questionType: z.enum(QUESTION_TYPES).default("SHORT_ANSWER"),
  prompt: z.string().trim().max(10000).optional().default(""),
  description: optionalTrimmedString(2000),
  formulaLatex: optionalTrimmedString(1000),
  options: z.array(z.string()).default([]),
  marks: z.number().min(0).max(1000).default(10),
  negativeMarks: z.number().min(0).max(100).default(0),
  partialCredit: z.boolean().default(false),
  acceptedAnswers: z.array(z.string()).default([]),
  modelAnswer: optionalTrimmedString(5000),
  expectedFormula: optionalTrimmedString(1000),
  expectedUnit: optionalTrimmedString(40),
  numericTolerance: z.number().min(0).max(10000).default(0),
  caseSensitive: z.boolean().default(false),
});

export const assignmentAttachmentInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  displayTitle: optionalTrimmedString(200),
  description: optionalTrimmedString(500),
  mimeType: z.string().trim().min(1).max(160),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
  storagePath: z.string().trim().min(1).max(500),
  attachmentRole: z.enum(ATTACHMENT_ROLES).default("ASSIGNMENT_MAIN"),
  sortOrder: z.number().int().min(1).max(100).default(1),
});

export type AssignmentAttachmentInput = z.infer<typeof assignmentAttachmentInputSchema>;

const assignmentBaseFields = {
  title: z.string().trim().min(1, "Assignment title is required.").max(200),
  description: optionalTrimmedString(4000),
  instructions: optionalTrimmedString(10000),
  learningObjectives: optionalTrimmedString(2000),
  courseId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || z.uuid().safeParse(v).success, {
      message: "Selected course ID is invalid.",
    }),
  manualCourseCode: optionalTrimmedString(40),
  manualCourseName: optionalTrimmedString(160),
  manualDepartment: optionalTrimmedString(120),
  manualFaculty: optionalTrimmedString(120),
  manualLevel: optionalTrimmedString(40),
  academicSession: optionalTrimmedString(80),
  semester: optionalTrimmedString(40),
  classGroup: optionalTrimmedString(80),
  targetAudience: z.enum(ASSIGNMENT_TARGET_AUDIENCES).default("ALL_INSTITUTION"),
  targetDepartment: optionalTrimmedString(120),
  targetLevel: optionalTrimmedString(40),
  targetClassSessionId: optionalTimestampString(),
  category: z.enum(ASSIGNMENT_CATEGORIES).default("HOMEWORK"),
  opensAt: optionalTimestampString(),
  dueAt: optionalTimestampString(),
  closesAt: optionalTimestampString(),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  latePolicy: z.enum(LATE_POLICIES).default("ALLOW_WITH_FLAG"),
  latePenaltyPercent: z.number().int().min(0).max(100).default(0),
  allowedFormats: z.array(z.string().min(1)).min(1, "Select at least one allowed submission format.").default(["TEXT", "PDF", "IMAGE", "CAMERA"]),
  maxUploadMb: z.number().int().min(1).max(50).default(10),
  submissionMode: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
  allowTextAnswer: z.boolean().default(true),
  allowFileUpload: z.boolean().default(true),
  allowPhotoSubmission: z.boolean().default(true),
  allowEditAfterSubmit: z.boolean().default(false),
  allowResubmission: z.boolean().default(false),
  markingMode: z.enum(MARKING_MODES).default("HYBRID"),
  subjectDomain: z.enum(SUBJECT_DOMAINS).default("GENERAL"),
  markingInstructions: optionalTrimmedString(10000),
  maxAttachments: z.number().int().min(1).max(20).default(5),
  totalMarks: z.number().positive().max(10000).default(100),
  releaseMarksImmediately: z.boolean().default(false),
  publishNow: z.boolean().default(false),
  questions: z.array(assignmentQuestionInputSchema).default([]),
  attachments: z.array(assignmentAttachmentInputSchema).default([]),
};

function validateAssignmentBusinessRules(
  value: {
    courseId?: string | null;
    manualCourseCode?: string;
    manualCourseName?: string;
    instructions?: string;
    description?: string;
    questions: Array<{ prompt?: string }>;
    attachments?: Array<{ attachmentRole?: string }>;
  },
  ctx: z.RefinementCtx,
) {
  const hasCatalogCourse = Boolean(value.courseId);
  const hasManualCourseName = Boolean(value.manualCourseName?.trim());
  const hasManualCourseCode = Boolean(value.manualCourseCode?.trim());
  if (!hasCatalogCourse && !hasManualCourseName && !hasManualCourseCode) {
    ctx.addIssue({
      code: "custom",
      path: ["manualCourseName"],
      message: "Select an existing course or enter a course name.",
    });
  }

  const nonEmptyQuestions = value.questions.filter((q) => Boolean(q.prompt?.trim()));
  const hasStudentAttachment = (value.attachments ?? []).some((a) => a.attachmentRole !== "LECTURER_ONLY");
  const hasBlankQuestion = value.questions.some((q) => !q.prompt?.trim());
  if (hasBlankQuestion && value.questions.length > 0 && nonEmptyQuestions.length > 0) {
    value.questions.forEach((q, idx) => {
      if (!q.prompt?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", idx, "prompt"],
          message: `Question ${idx + 1} prompt cannot be empty (or remove the blank question).`,
        });
      }
    });
  } else if (
    nonEmptyQuestions.length === 0 &&
    !value.instructions?.trim() &&
    !value.description?.trim() &&
    !hasStudentAttachment
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["questions", 0, "prompt"],
      message: "Upload an assignment document, add instructions, or add at least one question.",
    });
  }
}

export const createAssignmentSchema = z
  .object(assignmentBaseFields)
  .superRefine(validateAssignmentBusinessRules);

export const updateAssignmentSchema = z
  .object({
    assignmentId: z.uuid(),
    ...assignmentBaseFields,
    changeSummary: optionalTrimmedString(500),
    notifyStudents: z.boolean().optional().default(true),
  })
  .superRefine(validateAssignmentBusinessRules);

export const archiveAssignmentSchema = z.object({
  assignmentId: z.uuid(),
});

export const deleteAssignmentSchema = z.object({
  assignmentId: z.uuid(),
  confirmed: z.literal(true, {
    error: "Please confirm assignment deletion before proceeding.",
  }),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
