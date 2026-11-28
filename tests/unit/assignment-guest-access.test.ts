import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORG_ID = "b0000000-0000-4000-8000-000000000001";
const ASSIGNMENT_ID = "a1000000-0000-4000-8000-000000000010";
const COURSE_ID = "3d0709a6-fcc0-401a-a8a3-a76bd4890406";
const STUDENT_ID = "51000000-0000-4000-8000-000000000001";
const SECRET = "test-assignment-signing-secret-32-chars";

const state = vi.hoisted(() => ({
  results: {} as Record<string, { data: unknown; error: null }>,
}));

function chain(table: string) {
  const result = () => state.results[table] ?? { data: null, error: null };
  const c: Record<string, unknown> = {
    select: () => c,
    eq: () => c,
    ilike: () => c,
    order: () => c,
    insert: () => c,
    update: () => c,
    single: async () => result(),
    maybeSingle: async () => result(),
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => Promise.resolve(result()).then(res, rej),
  };
  return c;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/join-server", () => ({
  createJoinSupabaseClient: () => ({ from: (table: string) => chain(table) }),
}));

import { signAssignmentGuestToken, verifyAssignmentGuestToken } from "@/lib/academic/distribution";
import { verifyGuestStudentForAssignment } from "@/lib/academic/guest-actions";

function freshToken() {
  return signAssignmentGuestToken(ORG_ID, ASSIGNMENT_ID, Math.floor(Date.now() / 1000) + 3600);
}

beforeEach(() => {
  vi.stubEnv("ATTENDANCE_QR_SECRET", SECRET);
  state.results = {
    school_profiles: {
      data: { id: STUDENT_ID, matric_number: "MEE/2023/001", level: "400", department_id: null },
      error: null,
    },
    people: { data: { full_name: "Test Student", clerk_user_id: null }, error: null },
    assignments: {
      data: {
        id: ASSIGNMENT_ID,
        title: "QA Assignment - Muse audit",
        course_id: COURSE_ID,
        fee_category: "STANDARD",
        status: "PUBLISHED",
        target_audience: "COURSE_ENROLLED",
        target_level: null,
        target_class_session_id: null,
      },
      error: null,
    },
    // Enrolled by default; the non-enrolled test overrides this with null.
    course_students: { data: { student_id: STUDENT_ID }, error: null },
  };
});

afterEach(() => vi.unstubAllEnvs());

describe("Step 1 — shared assignment link tokens", () => {
  it("verifies a freshly minted share-link token for a published assignment", () => {
    const parsed = verifyAssignmentGuestToken(freshToken());
    expect(parsed.assignmentId).toBe(ASSIGNMENT_ID);
    expect(parsed.orgId).toBe(ORG_ID);
  });

  it("rejects an expired token with an 'expired' error (mapped to a friendly page, not a bare 404)", () => {
    const expired = signAssignmentGuestToken(ORG_ID, ASSIGNMENT_ID, Math.floor(Date.now() / 1000) - 60);
    expect(() => verifyAssignmentGuestToken(expired)).toThrow(/expired/);
  });
});

describe("Step 2 — COURSE_ENROLLED audience check (course_students)", () => {
  it("admits a student who IS enrolled in the course", async () => {
    const res = await verifyGuestStudentForAssignment({ token: freshToken(), matricNumber: "MEE/2023/001" });
    expect(res.ok).toBe(true);
  });

  it("blocks a student who is NOT enrolled, with the restricted message", async () => {
    state.results.course_students = { data: null, error: null };
    const res = await verifyGuestStudentForAssignment({ token: freshToken(), matricNumber: "MEE/2023/001" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/registered for this course/);
  });
});
