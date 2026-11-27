import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssignmentForEdit } from "@/lib/academic/data";
import { PageHeading } from "@/components/ui/workspace";
import { AssignmentWizard, type InitialAssignmentData } from "@/components/academic/assignment-wizard";

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const data = await getAssignmentForEdit(assignmentId);
  if (!data) notFound();

  const a = data.assignment;
  const keyByQuestion = new Map<string, Record<string, unknown>>();
  for (const k of data.answerKeys) {
    if (k.question_id) keyByQuestion.set(String(k.question_id), k);
  }

  const initialData: InitialAssignmentData = {
    id: String(a.id),
    title: String(a.title ?? ""),
    courseId: a.course_id ? String(a.course_id) : "",
    manualCourseCode: String(a.manual_course_code ?? ""),
    manualCourseName: String(a.manual_course_name ?? ""),
    manualDepartment: String(a.manual_department ?? ""),
    manualFaculty: String(a.manual_faculty ?? ""),
    manualLevel: String(a.manual_level ?? ""),
    category: String(a.category ?? "HOMEWORK"),
    academicSession: String(a.academic_session ?? ""),
    semester: String(a.semester ?? ""),
    description: String(a.description ?? ""),
    instructions: String(a.instructions ?? ""),
    dueAt: a.due_at ? String(a.due_at) : "",
    latePolicy: String(a.late_policy ?? "ALLOW_WITH_FLAG"),
    submissionMode: String(a.submission_mode ?? "INDIVIDUAL"),
    allowTextAnswer: Boolean(a.allow_text_answer ?? true),
    allowFileUpload: Boolean(a.allow_file_upload ?? true),
    allowPhotoSubmission: Boolean(a.allow_photo_submission ?? true),
    maxAttempts: Number(a.max_attempts ?? 1),
    maxAttachments: Number(a.max_attachments ?? 5),
    markingMode: String(a.marking_mode ?? "HYBRID"),
    subjectDomain: String(a.subject_domain ?? "GENERAL"),
    markingInstructions: String(a.marking_instructions ?? ""),
    releaseMarksImmediately: Boolean(a.release_marks_immediately ?? false),
    status: String(a.status ?? "DRAFT"),
    attachments: data.attachments.map((att, idx) => ({
      id: String(att.id ?? crypto.randomUUID()),
      fileName: String(att.file_name ?? "document"),
      displayTitle: String(att.display_title ?? att.file_name ?? "Document"),
      description: String(att.description ?? ""),
      mimeType: String(att.mime_type ?? "application/octet-stream"),
      sizeBytes: Number(att.size_bytes ?? 0),
      storagePath: String(att.storage_path ?? ""),
      attachmentRole: (String(att.attachment_role ?? "ASSIGNMENT_MAIN") as "ASSIGNMENT_MAIN" | "REFERENCE" | "LECTURER_ONLY"),
      sortOrder: Number(att.sort_order ?? idx + 1),
    })),
    questions: data.questions.map((q) => {
      const key = keyByQuestion.get(String(q.id));
      return {
        id: String(q.id),
        questionType: String(q.question_type ?? "SHORT_ANSWER"),
        prompt: String(q.prompt ?? ""),
        description: String(q.description ?? ""),
        formulaLatex: String(q.formula_latex ?? ""),
        optionsText: Array.isArray(q.options) ? q.options.map(String).join("\n") : "",
        acceptedAnswersText: Array.isArray(key?.accepted_answers)
          ? key.accepted_answers.map(String).join(", ")
          : "",
        modelAnswer: String(key?.model_answer ?? ""),
        expectedUnit: String(key?.expected_unit ?? ""),
        numericTolerance: Number(key?.numeric_tolerance ?? 0),
        marks: Number(q.marks ?? 10),
        negativeMarks: Number(q.negative_marks ?? 0),
        partialCredit: Boolean(q.partial_credit ?? false),
        caseSensitive: Boolean(key?.case_sensitive ?? false),
      };
    }),
  };

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow="EDIT ASSIGNMENT"
        title={initialData.title || "Edit Assignment"}
        description="Update assignment details, questions, deadlines, and course metadata. Existing submissions and payments are preserved."
        action={
          <Link href={`/dashboard/academic/assignments/${assignmentId}`} className="button-secondary">
            Back to assignment
          </Link>
        }
      />

      <AssignmentWizard courses={data.courses} mode="edit" initialData={initialData} />
    </main>
  );
}
