import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import {
  buildQuestionAnswers,
  buildStudentIdentityMap,
  submissionStudentName,
  type ReviewQuestion,
} from "@/lib/academic/submission-review";
import { PageHeading, StatCard } from "@/components/ui/workspace";
import { SubmissionReviewer, type SubmissionRow } from "@/components/academic/submission-reviewer";

type Row = Record<string, unknown>;

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const membership = await requireBusinessMembership();
  const db = createJoinSupabaseClient() as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c2: string, v2: unknown) => {
            maybeSingle: () => Promise<{ data: Row | null }>;
            order: (c3: string, opts?: { ascending: boolean }) => Promise<{ data: Row[] | null }>;
          };
          in: (c2: string, v2: unknown[]) => Promise<{ data: Row[] | null }>;
          order: (c2: string, opts?: { ascending: boolean }) => Promise<{ data: Row[] | null }>;
        };
      };
    };
  };

  const { data: assignment } = await db
    .from("assignments")
    .select("id,title,category,status,total_marks,due_at,marking_mode")
    .eq("id", assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!assignment) notFound();

  const [{ data: rawSubs }, { data: rawQuestions }] = await Promise.all([
    db
      .from("assignment_submissions")
      .select("id,student_id,submission_reference,status,is_late,submitted_at,text_content,answers_json,auto_score,final_score,lecturer_remarks,grade_released")
      .eq("assignment_id", assignmentId)
      .eq("organization_id", membership.businessId)
      .order("updated_at", { ascending: false }),
    db
      .from("assignment_questions")
      .select("id,position,prompt,marks")
      .eq("assignment_id", assignmentId)
      .order("position", { ascending: true }),
  ]);

  const questions: ReviewQuestion[] = (rawQuestions ?? []).map((q) => ({
    id: String(q.id),
    position: Number(q.position ?? 0),
    prompt: String(q.prompt ?? ""),
    marks: Number(q.marks ?? 0),
  }));

  const visibleSubs = (rawSubs ?? []).filter((s) => s.status !== "DRAFT");
  const studentIds = [...new Set(visibleSubs.map((s) => String(s.student_id)))];

  let identityByStudent = new Map<string, { fullName: string | null; matricNumber: string }>();
  if (studentIds.length > 0) {
    const [{ data: peopleRows }, { data: profileRows }] = await Promise.all([
      db
        .from("people")
        .select("id,full_name")
        .eq("organization_id", membership.businessId)
        .in("id", studentIds),
      db
        .from("school_profiles")
        .select("id,matric_number")
        .eq("organization_id", membership.businessId)
        .in("id", studentIds),
    ]);
    identityByStudent = buildStudentIdentityMap(
      (peopleRows ?? []).map((r) => ({ id: String(r.id), full_name: r.full_name })),
      (profileRows ?? []).map((r) => ({ id: String(r.id), matric_number: r.matric_number })),
    );
  }

  const submissions: SubmissionRow[] = visibleSubs.map((s) => {
    const studentId = String(s.student_id);
    const identity = identityByStudent.get(studentId);
    return {
      id: String(s.id),
      studentName: submissionStudentName(studentId, identity),
      matricNumber: identity?.matricNumber ?? "",
      submissionReference: String(s.submission_reference),
      status: String(s.status),
      isLate: Boolean(s.is_late),
      submittedAt: s.submitted_at ? String(s.submitted_at) : null,
      textContent: s.text_content ? String(s.text_content) : null,
      questionAnswers: buildQuestionAnswers(questions, s.answers_json),
      autoScore: s.auto_score != null ? Number(s.auto_score) : null,
      finalScore: s.final_score != null ? Number(s.final_score) : null,
      lecturerRemarks: s.lecturer_remarks ? String(s.lecturer_remarks) : null,
      gradeReleased: Boolean(s.grade_released),
    };
  });

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow={String(assignment.category).replaceAll("_", " ")}
        title={String(assignment.title)}
        description={`Status: ${String(assignment.status)} · Total Marks: ${String(assignment.total_marks)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/academic/assignments/${assignmentId}/edit`} className="button-secondary">
              Edit assignment
            </Link>
            <Link href="/dashboard/academic/assignments" className="button-secondary">
              Back to assignments
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Submitted" value={submissions.length} />
        <StatCard
          label="Awaiting Marking"
          value={submissions.filter((s) => ["SUBMITTED", "LATE", "UNDER_REVIEW"].includes(s.status)).length}
        />
        <StatCard label="Late" value={submissions.filter((s) => s.isLate).length} />
      </section>

      <SubmissionReviewer
        assignmentId={assignmentId}
        assignmentStatus={String(assignment.status)}
        totalMarks={Number(assignment.total_marks)}
        submissions={submissions}
      />
    </main>
  );
}
