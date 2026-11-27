import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { PageHeading, StatCard } from "@/components/ui/workspace";
import { SubmissionReviewer, type SubmissionRow } from "@/components/academic/submission-reviewer";

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
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
            order: (c3: string, opts?: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
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

  const { data: rawSubs } = await db
    .from("assignment_submissions")
    .select("id,student_id,submission_reference,status,is_late,submitted_at,text_content,auto_score,final_score,lecturer_remarks,grade_released")
    .eq("assignment_id", assignmentId)
    .eq("organization_id", membership.businessId)
    .order("updated_at", { ascending: false });

  const submissions: SubmissionRow[] = (rawSubs ?? [])
    .filter((s) => s.status !== "DRAFT")
    .map((s) => ({
      id: String(s.id),
      studentName: `Student ${String(s.student_id).slice(0, 6)}`,
      matricNumber: String(s.student_id).slice(0, 8),
      submissionReference: String(s.submission_reference),
      status: String(s.status),
      isLate: Boolean(s.is_late),
      submittedAt: s.submitted_at ? String(s.submitted_at) : null,
      textContent: s.text_content ? String(s.text_content) : null,
      autoScore: s.auto_score != null ? Number(s.auto_score) : null,
      finalScore: s.final_score != null ? Number(s.final_score) : null,
      lecturerRemarks: s.lecturer_remarks ? String(s.lecturer_remarks) : null,
      gradeReleased: Boolean(s.grade_released),
    }));

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow={String(assignment.category).replaceAll("_", " ")}
        title={String(assignment.title)}
        description={`Status: ${String(assignment.status)} · Total Marks: ${String(assignment.total_marks)}`}
        action={
          <Link href="/dashboard/academic/assignments" className="button-secondary">
            Back to assignments
          </Link>
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
