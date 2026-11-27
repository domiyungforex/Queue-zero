import "server-only";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { requireUserId } from "@/lib/auth/server";

type UntypedQueryResult = Promise<{ data: unknown[] | null; error: unknown }>;
type UntypedSingleResult = Promise<{ data: unknown; error: unknown }>;
type UntypedEqChain = UntypedQueryResult & {
  eq: (col: string, val: unknown) => UntypedEqChain;
  is: (col: string, val: null) => {
    order: (col: string, opts?: { ascending: boolean }) => UntypedQueryResult;
    maybeSingle: () => UntypedSingleResult;
  };
  order: (col: string, opts?: { ascending: boolean }) => UntypedQueryResult;
  maybeSingle: () => UntypedSingleResult;
};

type UntypedClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => UntypedEqChain;
      in: (col: string, vals: unknown[]) => UntypedQueryResult;
    };
  };
};

export interface AssignmentSummary {
  id: string;
  course_id: string | null;
  course_code?: string;
  course_title?: string;
  manual_course_code?: string | null;
  manual_course_name?: string | null;
  course_classification_status?: string;
  title: string;
  category: string;
  status: string;
  due_at: string | null;
  total_marks: number;
  marking_mode: string;
  submission_mode: string;
  grades_published: boolean;
  created_at: string;
  edited_at?: string | null;
  archived_at?: string | null;
  submission_count?: number;
  awaiting_marking_count?: number;
  late_count?: number;
}

export async function getAcademicOverview() {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();
  const udb = db as unknown as UntypedClient;

  const [coursesRes, assignmentsRes, submissionsRes, integrityRes, studentsRes] = await Promise.all([
    db.from("courses").select("id,code,title,department_id").eq("organization_id", membership.businessId),
    udb
      .from("assignments")
      .select(
        "id,course_id,manual_course_code,manual_course_name,course_classification_status,title,category,status,due_at,total_marks,marking_mode,submission_mode,grades_published,created_at,edited_at,archived_at",
      )
      .eq("organization_id", membership.businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    udb.from("assignment_submissions").select("id,assignment_id,status,is_late,final_score,auto_score").eq("organization_id", membership.businessId).order("created_at", { ascending: false }),
    udb.from("similarity_matches").select("id,review_status,similarity_score").eq("organization_id", membership.businessId).order("created_at", { ascending: false }),
    db.from("school_profiles").select("id", { count: "exact", head: true }).eq("organization_id", membership.businessId),
  ]);

  const courses = (coursesRes.data ?? []) as Array<{ id: string; code: string; title: string; department_id: string }>;
  const assignments = (assignmentsRes.data ?? []) as AssignmentSummary[];
  const submissions = (submissionsRes.data ?? []) as Array<{
    id: string;
    assignment_id: string;
    status: string;
    is_late: boolean;
    final_score: number | null;
    auto_score: number | null;
  }>;
  const integrity = (integrityRes.data ?? []) as Array<{ id: string; review_status: string; similarity_score: number }>;

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const enrichedAssignments = assignments.map((a) => {
    const course = a.course_id ? courseMap.get(a.course_id) : undefined;
    const subs = submissions.filter((s) => s.assignment_id === a.id && s.status !== "DRAFT");
    return {
      ...a,
      course_code: course?.code ?? a.manual_course_code ?? "MANUAL",
      course_title: course?.title ?? a.manual_course_name ?? "",
      submission_count: subs.length,
      awaiting_marking_count: subs.filter((s) => ["SUBMITTED", "LATE", "UNDER_REVIEW", "RESUBMITTED"].includes(s.status)).length,
      late_count: subs.filter((s) => s.is_late).length,
    };
  });

  return {
    membership,
    courses,
    assignments: enrichedAssignments,
    stats: {
      totalCourses: courses.length,
      totalStudents: studentsRes.count ?? 0,
      totalAssignments: assignments.filter((a) => a.status !== "ARCHIVED").length,
      publishedAssignments: assignments.filter((a) => a.status === "PUBLISHED").length,
      draftAssignments: assignments.filter((a) => a.status === "DRAFT").length,
      archivedAssignments: assignments.filter((a) => a.status === "ARCHIVED").length,
      totalSubmissions: submissions.filter((s) => s.status !== "DRAFT").length,
      awaitingMarking: submissions.filter((s) => ["SUBMITTED", "LATE", "UNDER_REVIEW", "RESUBMITTED"].includes(s.status)).length,
      pendingIntegrityReviews: integrity.filter((i) => i.review_status === "PENDING").length,
    },
  };
}

export async function getStudentPortalData() {
  const membership = await requireBusinessMembership();
  const userId = await requireUserId();
  const db = await createUserSupabaseClient();
  const udb = db as unknown as UntypedClient;

  const { data: person } = await db
    .from("people")
    .select("id,full_name")
    .eq("organization_id", membership.businessId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let studentProfile: { id: string; matric_number: string; level: string } | null = null;
  if (person) {
    const { data: sp } = await db
      .from("school_profiles")
      .select("id,matric_number,level")
      .eq("id", person.id)
      .maybeSingle();
    studentProfile = sp;
  }

  const [coursesRes, assignmentsRes, submissionsRes] = await Promise.all([
    db.from("courses").select("id,code,title").eq("organization_id", membership.businessId),
    udb
      .from("assignments")
      .select("id,course_id,title,description,category,status,opens_at,due_at,closes_at,total_marks,submission_mode,allow_text_answer,allow_file_upload,allow_photo_submission,release_marks_immediately,grades_published,created_at")
      .eq("organization_id", membership.businessId)
      .is("deleted_at", null)
      .order("due_at", { ascending: true }),
    studentProfile
      ? udb
          .from("assignment_submissions")
          .select("id,assignment_id,submission_reference,status,attempt_number,is_late,submitted_at,auto_score,final_score,grade_released,lecturer_remarks,text_content,answers_json")
          .eq("student_id", studentProfile.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const courses = (coursesRes.data ?? []) as Array<{ id: string; code: string; title: string }>;
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const assignments = ((assignmentsRes.data ?? []) as AssignmentSummary[]).filter(
    (a) => a.status === "PUBLISHED" || a.status === "CLOSED",
  );
  const submissions = (submissionsRes.data ?? []) as Array<{
    id: string;
    assignment_id: string;
    submission_reference: string;
    status: string;
    attempt_number: number;
    is_late: boolean;
    submitted_at: string | null;
    auto_score: number | null;
    final_score: number | null;
    grade_released: boolean;
    lecturer_remarks: string | null;
    text_content: string | null;
    answers_json: Record<string, unknown>;
  }>;

  const enriched = assignments.map((a) => {
    const course = a.course_id ? courseMap.get(a.course_id) : undefined;
    const sub = submissions.find((s) => s.assignment_id === a.id) ?? null;
    return {
      ...a,
      course_code: course?.code ?? a.manual_course_code ?? "MANUAL",
      course_title: course?.title ?? a.manual_course_name ?? "",
      submission: sub,
    };
  });

  return {
    membership,
    person,
    studentProfile,
    assignments: enriched,
  };
}

export async function getAssignmentForEdit(assignmentId: string) {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();
  const udb = db as unknown as UntypedClient;

  const [coursesRes, assignmentRes, questionsRes, keysRes] = await Promise.all([
    db.from("courses").select("id,code,title,department_id").eq("organization_id", membership.businessId),
    udb
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .eq("organization_id", membership.businessId)
      .is("deleted_at", null)
      .maybeSingle(),
    udb
      .from("assignment_questions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("organization_id", membership.businessId)
      .order("position", { ascending: true }),
    udb
      .from("answer_keys")
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("organization_id", membership.businessId),
  ]);

  if (!assignmentRes.data) return null;

  return {
    membership,
    courses: (coursesRes.data ?? []) as Array<{ id: string; code: string; title: string; department_id: string }>,
    assignment: assignmentRes.data as Record<string, unknown>,
    questions: (questionsRes.data ?? []) as Array<Record<string, unknown>>,
    answerKeys: (keysRes.data ?? []) as Array<Record<string, unknown>>,
  };
}
