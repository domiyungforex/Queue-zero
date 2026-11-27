import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, FileText } from "lucide-react";
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
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          order: (col2: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };
  };

  const [qRes, attRes, fullAssignRes] = await Promise.all([
    db
      .from("assignment_questions")
      .select("id,position,question_type,prompt,formula_latex,options,marks")
      .eq("assignment_id", assignmentId)
      .order("position", { ascending: true }),
    db
      .from("assignment_attachments")
      .select("id,file_name,display_title,description,mime_type,size_bytes,attachment_role,sort_order")
      .eq("assignment_id", assignmentId)
      .order("sort_order", { ascending: true }),
    db
      .from("assignments")
      .select("instructions,opens_at,allow_text_answer,allow_file_upload,allow_photo_submission,max_upload_mb,max_attachments")
      .eq("id", assignmentId)
      .maybeSingle(),
  ]);

  const questions: StudentQuestionView[] = (qRes.data ?? []).map((q) => ({
    id: String(q.id),
    position: Number(q.position),
    questionType: String(q.question_type),
    prompt: String(q.prompt),
    formulaLatex: q.formula_latex ? String(q.formula_latex) : null,
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    marks: Number(q.marks ?? 0),
  }));

  const studentAttachments = (attRes.data ?? []).filter(
    (att) => String(att.attachment_role ?? "ASSIGNMENT_MAIN") !== "LECTURER_ONLY",
  );

  const cfg = fullAssignRes.data ?? {};
  const allowTextAnswer = cfg.allow_text_answer !== false;
  const allowFileUpload = cfg.allow_file_upload !== false;
  const allowPhotoSubmission = cfg.allow_photo_submission !== false;
  const maxUploadMb = Number(cfg.max_upload_mb ?? 25);
  const maxAttachments = Number(cfg.max_attachments ?? 5);
  const instructions = cfg.instructions ? String(cfg.instructions) : "";

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

      {instructions ? (
        <section className="panel p-5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Assignment Instructions</h2>
          <p className="whitespace-pre-wrap text-sm text-[#111318]">{instructions}</p>
        </section>
      ) : null}

      {studentAttachments.length > 0 ? (
        <section className="panel p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Assignment Documents &amp; Resources ({studentAttachments.length})
          </h2>
          <ul className="space-y-2.5">
            {studentAttachments.map((att) => {
              const id = String(att.id);
              const title = String(att.display_title || att.file_name || "Document");
              const mime = String(att.mime_type || "");
              const canPreview = mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("text/plain");
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#fffaf7] p-3.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#111318]">
                      <FileText size={15} className="text-[#ff6b2b]" aria-hidden="true" />
                      <span>{title}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
                        {String(att.attachment_role ?? "ASSIGNMENT_MAIN") === "REFERENCE" ? "Reference" : "Assignment"}
                      </span>
                    </div>
                    {att.description ? (
                      <p className="text-xs text-neutral-600">{String(att.description)}</p>
                    ) : null}
                    <p className="text-[11px] text-neutral-500">
                      {String(att.file_name)} · {(Number(att.size_bytes ?? 0) / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canPreview ? (
                      <a
                        href={`/api/academic/files/download?kind=attachment&id=${encodeURIComponent(id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button-secondary"
                      >
                        <Eye size={14} aria-hidden="true" /> Preview
                      </a>
                    ) : null}
                    <a
                      href={`/api/academic/files/download?kind=attachment&id=${encodeURIComponent(id)}&download=1`}
                      className="button-secondary"
                    >
                      <Download size={14} aria-hidden="true" /> Download
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
          allowTextAnswer={allowTextAnswer}
          allowFileUpload={allowFileUpload}
          allowPhotoSubmission={allowPhotoSubmission}
          maxUploadMb={maxUploadMb}
          maxAttachments={maxAttachments}
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
