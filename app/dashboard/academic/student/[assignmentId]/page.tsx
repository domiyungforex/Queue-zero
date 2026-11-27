import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudentPortalData } from "@/lib/academic/data";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { PageHeading } from "@/components/ui/workspace";
import { StudentSubmissionEditor, type StudentQuestionView } from "@/components/academic/student-submission-editor";

export default async function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const { assignments, studentProfile } = await getStudentPortalData();
  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) notFound();

  const db = createJoinSupabaseClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: unknown) => {
          order: (col2: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };
  };

  const { data: qRows } = await db
    .from("assignment_questions")
    .select("id,position,question_type,prompt,formula_latex,options,marks")
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true });

  const questions: StudentQuestionView[] = (qRows ?? []).map((q) => ({
    id: String(q.id),
    position: Number(q.position),
    questionType: String(q.question_type),
    prompt: String(q.prompt),
    formulaLatex: q.formula_latex ? String(q.formula_latex) : null,
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    marks: Number(q.marks ?? 0),
  }));

  const sub = assignment.submission;

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow={`${assignment.course_code ?? "COURSE"} · ${assignment.category.replaceAll("_", " ")}`}
        title={assignment.title}
        description={`Total Marks: ${assignment.total_marks}${assignment.due_at ? ` · Due ${new Date(assignment.due_at).toLocaleString()}` : ""}`}
        action={
          <Link href="/dashboard/academic/student" className="button-secondary">
            Back to My Assignments
          </Link>
        }
      />

      {!studentProfile ? (
        <div className="panel p-8">
          <p className="font-bold text-[#111318]">Student profile not linked</p>
          <p className="mt-1 text-sm text-neutral-600">
            Your signed-in account does not have a linked institutional student profile in this workspace yet.
          </p>
        </div>
      ) : (
        <StudentSubmissionEditor
          assignmentId={assignmentId}
          studentId={studentProfile.id}
          assignmentTitle={assignment.title}
          questions={questions}
          allowTextAnswer={true}
          allowFileUpload={true}
          allowPhotoSubmission={true}
          initialText={sub?.text_content ?? ""}
          initialAnswers={(sub?.answers_json as Record<string, string>) ?? {}}
          existingSubmission={
            sub
              ? {
                  status: sub.status,
                  reference: sub.submission_reference,
                  submittedAt: sub.submitted_at,
                  isLate: sub.is_late,
                  finalScore: sub.final_score,
                  gradeReleased: sub.grade_released,
                  lecturerRemarks: sub.lecturer_remarks,
                }
              : null
          }
        />
      )}
    </main>
  );
}
