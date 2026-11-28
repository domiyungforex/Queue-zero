import { describe, expect, it } from "vitest";
import { createAssignmentSchema } from "@/lib/academic/types";

// Reproduces the exact payload components/academic/assignment-wizard.tsx
// builds in save(): existing MEE 403 course selected, one SHORT_ANSWER
// question worth 10 marks, a deadline, session 2025/2026, semester First.
function wizardPayload(publishNow: boolean) {
  return {
    title: "QA Assignment - Muse audit",
    courseId: "3d0709a6-fcc0-401a-a8a3-a76bd4890406",
    manualCourseCode: "",
    manualCourseName: "",
    manualDepartment: "",
    manualFaculty: "",
    manualLevel: "",
    category: "HOMEWORK",
    academicSession: "2025/2026",
    semester: "First",
    description: "",
    instructions: "",
    learningObjectives: "",
    dueAt: new Date("2026-12-05T23:59").toISOString(),
    latePolicy: "ALLOW_WITH_FLAG",
    submissionMode: "INDIVIDUAL",
    allowTextAnswer: true,
    allowFileUpload: true,
    allowPhotoSubmission: true,
    maxAttempts: 1,
    maxAttachments: 5,
    targetAudience: "ALL_INSTITUTION",
    targetDepartment: "",
    targetLevel: "",
    markingMode: "HYBRID",
    subjectDomain: "GENERAL",
    markingInstructions: "",
    totalMarks: 10,
    releaseMarksImmediately: false,
    publishNow,
    attachments: [],
    questions: [
      {
        questionType: "SHORT_ANSWER",
        prompt: "State the second law of thermodynamics.",
        description: "",
        formulaLatex: "",
        options: [],
        acceptedAnswers: [],
        modelAnswer: "",
        expectedUnit: "",
        numericTolerance: 0,
        marks: 10,
        negativeMarks: 0,
        partialCredit: false,
        caseSensitive: false,
      },
    ],
  };
}

describe("assignment wizard payload vs createAssignmentSchema", () => {
  it("accepts the wizard payload for publish", () => {
    const parsed = createAssignmentSchema.safeParse(wizardPayload(true));
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
  });

  it("accepts the wizard payload for save-as-draft", () => {
    const parsed = createAssignmentSchema.safeParse(wizardPayload(false));
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
  });

  it("accepts the manual-course variant (no courseId)", () => {
    const payload = { ...wizardPayload(true), courseId: null, manualCourseCode: "MEE 403", manualCourseName: "Thermodynamics" };
    const parsed = createAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
  });
});
