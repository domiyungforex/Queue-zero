import { beforeEach, describe, expect, it, vi } from "vitest";

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const COURSE_ID = "3d0709a6-fcc0-401a-a8a3-a76bd4890406";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  results: {} as Record<string, { data: unknown; error: { code?: string; message?: string } | null }>,
  inserts: [] as Array<{ table: string; row: Row | Row[] }>,
  deletes: [] as string[],
}));

function chain(table: string) {
  const result = () => state.results[table] ?? { data: null, error: null };
  const c: Record<string, unknown> = {
    select: () => c,
    eq: () => c,
    order: () => c,
    insert: (row: Row | Row[]) => {
      state.inserts.push({ table, row });
      return c;
    },
    update: () => c,
    upsert: () => c,
    delete: () => {
      state.deletes.push(table);
      return c;
    },
    single: async () => result(),
    maybeSingle: async () => result(),
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => Promise.resolve(result()).then(res, rej),
  };
  return c;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/business/membership", () => ({
  requireBusinessMembership: async () => ({ businessId: BUSINESS_ID, role: "owner" }),
}));
vi.mock("@/lib/auth/server", () => ({ requireUserId: async () => "user_test_lecturer" }));
vi.mock("@/lib/db/join-server", () => ({
  createJoinSupabaseClient: () => ({ from: (table: string) => chain(table) }),
}));
vi.mock("@/lib/db/server", () => ({
  createUserSupabaseClient: async () => ({ from: (table: string) => chain(table) }),
}));
vi.mock("@/lib/ai/anthropic", () => ({
  evaluateSubjectiveAnswerWithClaude: async () => ({ ok: false }),
  generateQuestionsWithClaude: async () => ({ ok: false }),
}));
vi.mock("@/lib/storage/store-image", () => ({ readPrivateImage: async () => null }));
vi.mock("@/lib/academic/ingestion", () => ({ extractTextFromDocxBuffer: async () => null }));

import { createAssignmentAction } from "@/lib/academic/actions";

function wizardPayload(publishNow: boolean) {
  return {
    title: "QA Assignment - Muse audit",
    courseId: COURSE_ID,
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

beforeEach(() => {
  state.inserts = [];
  state.deletes = [];
  state.results = {
    courses: { data: { id: COURSE_ID }, error: null },
    assignments: { data: { id: "a1000000-0000-4000-8000-000000000001" }, error: null },
    assignment_questions: { data: { id: "a1000000-0000-4000-8000-000000000002" }, error: null },
    answer_keys: { data: null, error: null },
    assignment_attachments: { data: null, error: null },
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createAssignmentAction with the wizard payload", () => {
  it("publishes: inserts the assignment as PUBLISHED with its question and answer key", async () => {
    const res = await createAssignmentAction(wizardPayload(true));
    expect(res.ok).toBe(true);
    const assignmentInsert = state.inserts.find((i) => i.table === "assignments");
    expect((assignmentInsert?.row as Row)?.status).toBe("PUBLISHED");
    expect((assignmentInsert?.row as Row)?.course_id).toBe(COURSE_ID);
    expect(state.inserts.some((i) => i.table === "assignment_questions")).toBe(true);
    expect(state.inserts.some((i) => i.table === "answer_keys")).toBe(true);
  });

  it("saves a draft: inserts the assignment as DRAFT", async () => {
    const res = await createAssignmentAction(wizardPayload(false));
    expect(res.ok).toBe(true);
    const assignmentInsert = state.inserts.find((i) => i.table === "assignments");
    expect((assignmentInsert?.row as Row)?.status).toBe("DRAFT");
  });

  it("surfaces a specific reason (and logs the code) when the assignments table rejects the insert", async () => {
    state.results.assignments = {
      data: null,
      error: { code: "42703", message: 'column "subject_domain" of relation "assignments" does not exist' },
    };
    const res = await createAssignmentAction(wizardPayload(true));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/database update is pending/);
      expect(res.error).not.toBe("Could not save assignment.");
    }
    expect(console.error).toHaveBeenCalledWith(
      "Assignment save failed",
      expect.objectContaining({ stage: "assignments.insert", code: "42703" }),
    );
  });

  it("removes the partial assignment when a question insert fails", async () => {
    state.results.assignment_questions = {
      data: null,
      error: { code: "42P01", message: 'relation "public.assignment_questions" does not exist' },
    };
    const res = await createAssignmentAction(wizardPayload(true));
    expect(res.ok).toBe(false);
    expect(state.deletes).toContain("assignments");
  });
});
