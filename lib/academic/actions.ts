"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { archiveAssignmentSchema, createAssignmentSchema, deleteAssignmentSchema, updateAssignmentSchema } from "./types";
import { signAssignmentGuestToken } from "./distribution";
import { computeLetterGrade, gradeObjectiveSubmission, type ObjectiveQuestionKey } from "./marking";
import { analyzeSubmissionSimilarity, assessAiWritingRisk } from "./integrity";

type DbResult<T = unknown> = Promise<{ data: T | null; error: { message?: string } | null; count?: number | null }>;

function academicDb() {
  return createJoinSupabaseClient() as unknown as {
    from: (table: string) => {
      select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => {
        eq: (c: string, v: unknown) => {
          eq: (c2: string, v2: unknown) => {
            maybeSingle: () => DbResult<Record<string, unknown>>;
            order: (c3: string, opts?: { ascending: boolean }) => DbResult<Record<string, unknown>[]>;
          } & DbResult<Record<string, unknown>[]>;
          maybeSingle: () => DbResult<Record<string, unknown>>;
          order: (c3: string, opts?: { ascending: boolean }) => DbResult<Record<string, unknown>[]>;
        } & DbResult<Record<string, unknown>[]>;
      };
      insert: (row: unknown) => {
        select: (cols: string) => { single: () => DbResult<Record<string, unknown>> };
      } & DbResult<unknown>;
      upsert: (row: unknown, opts?: { onConflict?: string }) => DbResult<unknown>;
      update: (row: unknown) => {
        eq: (c: string, v: unknown) => {
          eq: (c2: string, v2: unknown) => DbResult<unknown>;
        } & DbResult<unknown>;
      };
      delete: () => {
        eq: (c: string, v: unknown) => {
          eq: (c2: string, v2: unknown) => DbResult<unknown>;
        } & DbResult<unknown>;
      };
    };
  };
}

function isStaffRole(role: string) {
  return ["owner", "admin", "manager", "lecturer"].includes(role);
}

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createAssignmentAction(input: unknown) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) {
    return { ok: false as const, error: "Not authorized to create assignments." };
  }

  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment data.",
      fieldErrors,
    };
  }

  const v = parsed.data;
  const activeQuestions = v.questions.filter((q) => Boolean(q.prompt?.trim()));
  if (v.publishNow && activeQuestions.length === 0 && !v.instructions?.trim()) {
    return {
      ok: false as const,
      error: "Add at least one question or instructions before publishing.",
      fieldErrors: { "questions.0.prompt": "Add at least one question or instructions before publishing." },
    };
  }

  const userId = await requireUserId();
  const userDb = await createUserSupabaseClient();
  if (v.courseId) {
    const { data: course } = await userDb
      .from("courses")
      .select("id")
      .eq("id", v.courseId)
      .eq("organization_id", membership.businessId)
      .maybeSingle();

    if (!course) {
      return {
        ok: false as const,
        error: "Selected course was not found or access was denied.",
        fieldErrors: { courseId: "Selected course was not found or access was denied." },
      };
    }
  }

  const db = academicDb();
  const status = v.publishNow ? "PUBLISHED" : "DRAFT";
  const courseClassificationStatus = v.courseId ? "CATALOG" : "MANUAL_UNVERIFIED";
  const { data: created, error } = await db
    .from("assignments")
    .insert({
      organization_id: membership.businessId,
      course_id: v.courseId || null,
      manual_course_code: v.courseId ? null : v.manualCourseCode || null,
      manual_course_name: v.courseId ? null : v.manualCourseName || null,
      manual_department: v.courseId ? null : v.manualDepartment || null,
      manual_faculty: v.courseId ? null : v.manualFaculty || null,
      manual_level: v.courseId ? null : v.manualLevel || null,
      course_classification_status: courseClassificationStatus,
      created_by: userId,
      title: v.title,
      description: v.description || null,
      instructions: v.instructions || null,
      learning_objectives: v.learningObjectives || null,
      academic_session: v.academicSession || null,
      semester: v.semester || null,
      class_group: v.classGroup || null,
      category: v.category,
      status,
      opens_at: v.opensAt || null,
      due_at: v.dueAt || null,
      closes_at: v.closesAt || null,
      published_at: v.publishNow ? new Date().toISOString() : null,
      max_attempts: v.maxAttempts,
      late_policy: v.latePolicy,
      late_penalty_percent: v.latePenaltyPercent,
      allowed_formats: v.allowedFormats,
      max_upload_mb: v.maxUploadMb,
      submission_mode: v.submissionMode,
      allow_text_answer: v.allowTextAnswer,
      allow_file_upload: v.allowFileUpload,
      allow_photo_submission: v.allowPhotoSubmission,
      allow_edit_after_submit: v.allowEditAfterSubmit,
      allow_resubmission: v.allowResubmission,
      marking_mode: v.markingMode,
      total_marks: v.totalMarks,
      release_marks_immediately: v.releaseMarksImmediately,
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    return { ok: false as const, error: "Could not save assignment." };
  }

  const assignmentId = String(created.id);
  for (let i = 0; i < activeQuestions.length; i += 1) {
    const q = activeQuestions[i];
    const { data: qRow } = await db
      .from("assignment_questions")
      .insert({
        organization_id: membership.businessId,
        assignment_id: assignmentId,
        position: i + 1,
        question_type: q.questionType,
        prompt: q.prompt.trim(),
        description: q.description || null,
        formula_latex: q.formulaLatex || null,
        options: q.options,
        marks: q.marks,
        negative_marks: q.negativeMarks,
        partial_credit: q.partialCredit,
      })
      .select("id")
      .single();

    if (qRow?.id) {
      await db.from("answer_keys").insert({
        organization_id: membership.businessId,
        assignment_id: assignmentId,
        question_id: qRow.id,
        accepted_answers: q.acceptedAnswers,
        model_answer: q.modelAnswer || null,
        expected_formula: q.expectedFormula || null,
        expected_unit: q.expectedUnit || null,
        numeric_tolerance: q.numericTolerance,
        case_sensitive: q.caseSensitive,
      });
    }
  }

  revalidatePath("/dashboard/academic");
  revalidatePath("/dashboard/academic/assignments");
  return { ok: true as const, assignmentId };
}

export async function publishAssignmentAction(assignmentId: string) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  if (!z.uuid().safeParse(assignmentId).success) return { ok: false as const, error: "Invalid assignment." };

  const db = academicDb();
  const { error } = await db
    .from("assignments")
    .update({ status: "PUBLISHED", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("organization_id", membership.businessId);

  if (error) return { ok: false as const, error: "Could not publish assignment." };
  revalidatePath("/dashboard/academic/assignments");
  revalidatePath(`/dashboard/academic/assignments/${assignmentId}`);
  return { ok: true as const };
}

export async function saveSubmissionDraftAction(input: {
  assignmentId: string;
  studentId: string;
  textContent: string;
  answers: Record<string, unknown>;
}) {
  const membership = await requireBusinessMembership();
  if (!z.uuid().safeParse(input.assignmentId).success || !z.uuid().safeParse(input.studentId).success) {
    return { ok: false as const, error: "Invalid submission request." };
  }

  const db = academicDb();
  const { data: existing } = await db
    .from("assignment_submissions")
    .select("id,status")
    .eq("assignment_id", input.assignmentId)
    .eq("student_id", input.studentId)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing?.id) {
    if (existing.status !== "DRAFT" && existing.status !== "RETURNED") {
      return { ok: false as const, error: "Assignment has already been submitted." };
    }
    await db
      .from("assignment_submissions")
      .update({
        text_content: input.textContent,
        answers_json: input.answers,
        last_autosaved_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("organization_id", membership.businessId);
    return { ok: true as const, submissionId: String(existing.id), savedAt: now };
  }

  const ref = `SUB-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: created, error } = await db
    .from("assignment_submissions")
    .insert({
      organization_id: membership.businessId,
      assignment_id: input.assignmentId,
      student_id: input.studentId,
      submission_reference: ref,
      request_id: randomUUID(),
      status: "DRAFT",
      attempt_number: 1,
      text_content: input.textContent,
      answers_json: input.answers,
      last_autosaved_at: now,
    })
    .select("id")
    .single();

  if (error || !created?.id) return { ok: false as const, error: "Autosave failed." };
  return { ok: true as const, submissionId: String(created.id), savedAt: now };
}

export async function submitAssignmentAction(input: {
  assignmentId: string;
  studentId: string;
  requestId: string;
  textContent: string;
  answers: Record<string, unknown>;
  files?: Array<{ fileName: string; mimeType: string; sizeBytes: number; storagePath: string; pageOrder: number; isHandwritten: boolean }>;
}) {
  const membership = await requireBusinessMembership();
  if (!z.uuid().safeParse(input.assignmentId).success || !z.uuid().safeParse(input.studentId).success || !z.uuid().safeParse(input.requestId).success) {
    return { ok: false as const, error: "Invalid submission request." };
  }

  const db = academicDb();
  const { data: assignment } = await db
    .from("assignments")
    .select("id,course_id,status,due_at,closes_at,late_policy,marking_mode,release_marks_immediately")
    .eq("id", input.assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!assignment || assignment.status !== "PUBLISHED") {
    return { ok: false as const, error: "This assignment is not accepting submissions." };
  }

  const now = new Date();
  const dueAt = assignment.due_at ? new Date(String(assignment.due_at)) : null;
  const closesAt = assignment.closes_at ? new Date(String(assignment.closes_at)) : null;
  if (closesAt && now > closesAt) {
    return { ok: false as const, error: "The closing deadline has passed." };
  }
  const isLate = Boolean(dueAt && now > dueAt);
  if (isLate && assignment.late_policy === "BLOCK") {
    return { ok: false as const, error: "Late submissions are not allowed for this assignment." };
  }

  // Idempotency check
  const { data: replay } = await db
    .from("assignment_submissions")
    .select("id,submission_reference,status,submitted_at")
    .eq("assignment_id", input.assignmentId)
    .eq("request_id", input.requestId)
    .maybeSingle();

  if (replay?.id && replay.status !== "DRAFT") {
    return {
      ok: true as const,
      submissionId: String(replay.id),
      reference: String(replay.submission_reference),
      submittedAt: String(replay.submitted_at),
      isLate,
    };
  }

  const { data: existingDraft } = await db
    .from("assignment_submissions")
    .select("id,submission_reference,status")
    .eq("assignment_id", input.assignmentId)
    .eq("student_id", input.studentId)
    .maybeSingle();

  if (existingDraft?.id && !["DRAFT", "RETURNED"].includes(String(existingDraft.status))) {
    return { ok: false as const, error: "You have already submitted this assignment." };
  }

  // Run objective auto-marking
  const { data: qRows } = await db
    .from("assignment_questions")
    .select("id,question_type,marks,negative_marks,partial_credit")
    .eq("assignment_id", input.assignmentId)
    .eq("organization_id", membership.businessId)
    .order("position", { ascending: true });

  const { data: keyRows } = await db
    .from("answer_keys")
    .select("question_id,accepted_answers,model_answer,expected_unit,numeric_tolerance,case_sensitive")
    .eq("assignment_id", input.assignmentId)
    .eq("organization_id", membership.businessId)
    .order("created_at", { ascending: true });

  const keyMap = new Map((keyRows ?? []).map((k) => [String(k.question_id), k]));
  const objectiveKeys: ObjectiveQuestionKey[] = (qRows ?? []).map((q) => {
    const k = keyMap.get(String(q.id));
    return {
      questionId: String(q.id),
      questionType: String(q.question_type) as ObjectiveQuestionKey["questionType"],
      marks: Number(q.marks ?? 0),
      negativeMarks: Number(q.negative_marks ?? 0),
      partialCredit: Boolean(q.partial_credit),
      acceptedAnswers: Array.isArray(k?.accepted_answers) ? k.accepted_answers.map(String) : [],
      modelAnswer: k?.model_answer ? String(k.model_answer) : null,
      expectedUnit: k?.expected_unit ? String(k.expected_unit) : null,
      numericTolerance: k?.numeric_tolerance != null ? Number(k.numeric_tolerance) : 0,
      caseSensitive: Boolean(k?.case_sensitive),
    };
  });

  const autoEval = gradeObjectiveSubmission(objectiveKeys, input.answers);
  const allObjective = !autoEval.hasSubjective && objectiveKeys.length > 0;
  const finalStatus = allObjective ? "AUTO_MARKED" : isLate ? "LATE" : "SUBMITTED";
  const releaseNow = allObjective && Boolean(assignment.release_marks_immediately);
  const submittedAt = now.toISOString();
  const ref = existingDraft?.submission_reference
    ? String(existingDraft.submission_reference)
    : `SUB-${randomUUID().slice(0, 8).toUpperCase()}`;

  let submissionId: string;
  if (existingDraft?.id) {
    submissionId = String(existingDraft.id);
    await db
      .from("assignment_submissions")
      .update({
        request_id: input.requestId,
        status: finalStatus,
        text_content: input.textContent,
        answers_json: input.answers,
        is_late: isLate,
        submitted_at: submittedAt,
        auto_score: autoEval.totalAutoScore,
        final_score: allObjective ? autoEval.totalAutoScore : null,
        grade_released: releaseNow,
        updated_at: submittedAt,
      })
      .eq("id", submissionId)
      .eq("organization_id", membership.businessId);
  } else {
    const { data: created, error } = await db
      .from("assignment_submissions")
      .insert({
        organization_id: membership.businessId,
        assignment_id: input.assignmentId,
        student_id: input.studentId,
        submission_reference: ref,
        request_id: input.requestId,
        status: finalStatus,
        attempt_number: 1,
        text_content: input.textContent,
        answers_json: input.answers,
        is_late: isLate,
        submitted_at: submittedAt,
        auto_score: autoEval.totalAutoScore,
        final_score: allObjective ? autoEval.totalAutoScore : null,
        grade_released: releaseNow,
      })
      .select("id")
      .single();
    if (error || !created?.id) return { ok: false as const, error: "Could not persist submission." };
    submissionId = String(created.id);
  }

  // Persist per-question auto-marking outcomes
  for (const res of autoEval.results) {
    await db.from("grading_results").upsert(
      {
        organization_id: membership.businessId,
        submission_id: submissionId,
        question_id: res.questionId,
        awarded_marks: res.awardedMarks,
        max_marks: res.maxMarks,
        marking_source: res.markingSource,
        lecturer_comment: res.explanation,
        criteria_satisfied: res.criteriaSatisfied,
        criteria_missing: res.criteriaMissing,
        updated_at: submittedAt,
      },
      { onConflict: "submission_id,question_id" },
    );
  }

  // Persist immutable file references
  for (const f of input.files ?? []) {
    await db.from("submission_files").insert({
      organization_id: membership.businessId,
      submission_id: submissionId,
      file_name: f.fileName,
      mime_type: f.mimeType,
      size_bytes: f.sizeBytes,
      storage_path: f.storagePath,
      page_order: f.pageOrder,
      is_handwritten: f.isHandwritten,
      immutable_at: submittedAt,
    });
    if (f.mimeType === "application/pdf" || f.isHandwritten) {
      await db.from("document_processing_jobs").insert({
        organization_id: membership.businessId,
        submission_id: submissionId,
        status: "QUEUED",
      });
    }
  }

  // Run non-blocking AI risk heuristic assessment on text answer
  if (input.textContent.trim().length > 0) {
    const risk = assessAiWritingRisk(submissionId, input.textContent);
    await db.from("ai_risk_assessments").upsert(
      {
        organization_id: membership.businessId,
        assignment_id: input.assignmentId,
        submission_id: submissionId,
        risk_category: risk.riskCategory,
        indicators: risk.indicators,
        excerpts: risk.excerpts,
        method: risk.method,
        limitations_note: risk.limitationsNote,
      },
      { onConflict: "submission_id" },
    );
  }

  revalidatePath(`/dashboard/academic/student/${input.assignmentId}`);
  revalidatePath(`/dashboard/academic/assignments/${input.assignmentId}`);
  return { ok: true as const, submissionId, reference: ref, submittedAt, isLate };
}

export async function gradeSubmissionAction(input: {
  submissionId: string;
  assignmentId: string;
  score: number;
  remarks: string;
  releaseNow: boolean;
  returnForCorrection?: boolean;
}) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized to grade." };
  const userId = await requireUserId();

  const db = academicDb();
  const { data: sub } = await db
    .from("assignment_submissions")
    .select("id,student_id,assignment_id")
    .eq("id", input.submissionId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!sub) return { ok: false as const, error: "Submission not found." };

  const status = input.returnForCorrection ? "RETURNED" : "MARKED";
  const now = new Date().toISOString();
  await db
    .from("assignment_submissions")
    .update({
      final_score: input.score,
      lecturer_remarks: input.remarks,
      status,
      graded_by: userId,
      graded_at: now,
      grade_released: input.releaseNow,
      updated_at: now,
    })
    .eq("id", input.submissionId)
    .eq("organization_id", membership.businessId);

  // Update gradebook entry
  const { data: assignment } = await db
    .from("assignments")
    .select("course_id,total_marks,category")
    .eq("id", input.assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (assignment?.course_id) {
    const pct = Number(assignment.total_marks) > 0 ? (input.score / Number(assignment.total_marks)) * 100 : input.score;
    const letter = computeLetterGrade(pct, []);
    await db.from("gradebook_entries").upsert(
      {
        organization_id: membership.businessId,
        course_id: assignment.course_id,
        student_id: sub.student_id,
        ca_score: assignment.category === "EXAM" ? 0 : input.score,
        exam_score: assignment.category === "EXAM" ? input.score : 0,
        total_score: input.score,
        letter_grade: letter,
        lecturer_remarks: input.remarks,
        status: input.releaseNow ? "PUBLISHED" : "APPROVED",
        updated_by: userId,
        updated_at: now,
      },
      { onConflict: "course_id,student_id" },
    );
  }

  revalidatePath(`/dashboard/academic/assignments/${input.assignmentId}`);
  revalidatePath("/dashboard/academic/gradebook");
  return { ok: true as const };
}

export async function runSimilarityAnalysisAction(assignmentId: string) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };

  const db = academicDb();
  const { data: subs } = await db
    .from("assignment_submissions")
    .select("id,student_id,text_content,submitted_at,status")
    .eq("assignment_id", assignmentId)
    .eq("organization_id", membership.businessId)
    .order("submitted_at", { ascending: true });

  const eligible = (subs ?? [])
    .filter((s) => s.status !== "DRAFT" && typeof s.text_content === "string" && s.text_content.trim().length > 20)
    .map((s) => ({
      submissionId: String(s.id),
      studentName: "Student",
      matricNumber: String(s.student_id).slice(0, 8),
      text: String(s.text_content),
      submittedAt: s.submitted_at ? String(s.submitted_at) : null,
    }));

  const matches = analyzeSubmissionSimilarity(eligible, 20);
  for (const m of matches) {
    await db.from("similarity_matches").insert({
      organization_id: membership.businessId,
      assignment_id: assignmentId,
      submission_a_id: m.submissionAId,
      submission_b_id: m.submissionBId,
      similarity_score: m.similarityScore,
      matching_passages: m.matchingPassages,
      explanation: m.explanation,
      review_status: "PENDING",
    });
  }

  revalidatePath("/dashboard/academic/integrity");
  return { ok: true as const, matchesFound: matches.length };
}

export async function reviewIntegrityMatchAction(input: {
  matchId: string;
  status: "DISMISSED" | "INVESTIGATING" | "ESCALATED" | "RESOLVED";
  note: string;
}) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  const userId = await requireUserId();

  const db = academicDb();
  await db
    .from("similarity_matches")
    .update({
      review_status: input.status,
      review_note: input.note,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.matchId)
    .eq("organization_id", membership.businessId);

  revalidatePath("/dashboard/academic/integrity");
  return { ok: true as const };
}

export async function createQuestionBankItemAction(input: {
  title: string;
  prompt: string;
  subject: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: string;
  marks: number;
  explanation?: string;
}) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  const userId = await requireUserId();

  const db = academicDb();
  const { error } = await db.from("question_bank_items").insert({
    organization_id: membership.businessId,
    created_by: userId,
    title: input.title,
    prompt: input.prompt,
    subject: input.subject || null,
    topic: input.topic || null,
    difficulty: input.difficulty,
    question_type: input.questionType,
    marks: input.marks,
    explanation: input.explanation || null,
  });

  if (error) return { ok: false as const, error: "Could not save question to bank." };
  revalidatePath("/dashboard/academic/question-bank");
  return { ok: true as const };
}

export async function updateAssignmentAction(input: unknown) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) {
    return { ok: false as const, error: "Not authorized to edit assignments." };
  }

  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment update.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const v = parsed.data;
  const userId = await requireUserId();
  const db = academicDb();

  const { data: existing } = await db
    .from("assignments")
    .select("*")
    .eq("id", v.assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!existing || existing.deleted_at) {
    return { ok: false as const, error: "Assignment not found." };
  }

  const isPrivileged = ["owner", "admin", "manager"].includes(membership.role);
  if (!isPrivileged && existing.created_by && existing.created_by !== userId) {
    return { ok: false as const, error: "Only the assignment creator or an administrator can edit this assignment." };
  }

  if (v.courseId) {
    const userDb = await createUserSupabaseClient();
    const { data: course } = await userDb
      .from("courses")
      .select("id")
      .eq("id", v.courseId)
      .eq("organization_id", membership.businessId)
      .maybeSingle();
    if (!course) {
      return {
        ok: false as const,
        error: "Selected course was not found or access was denied.",
        fieldErrors: { courseId: "Selected course was not found or access was denied." },
      };
    }
  }

  const activeQuestions = v.questions.filter((q) => Boolean(q.prompt?.trim()));
  if ((existing.status === "PUBLISHED" || v.publishNow) && activeQuestions.length === 0 && !v.instructions?.trim()) {
    return {
      ok: false as const,
      error: "Published assignments must include at least one question or instructions.",
      fieldErrors: { "questions.0.prompt": "Add at least one question or instructions." },
    };
  }

  const nowIso = new Date().toISOString();
  const existingQuestionsRes = await db
    .from("assignment_questions")
    .select("*")
    .eq("assignment_id", v.assignmentId)
    .order("position", { ascending: true });

  const existingVersionsRes = await db
    .from("assignment_versions")
    .select("version_number")
    .eq("assignment_id", v.assignmentId)
    .order("version_number", { ascending: false });

  const nextVersion = Number(existingVersionsRes.data?.[0]?.version_number ?? 0) + 1;
  await db.from("assignment_versions").insert({
    organization_id: membership.businessId,
    assignment_id: v.assignmentId,
    version_number: nextVersion,
    edited_by: userId,
    change_summary: v.changeSummary || `Updated assignment (v${nextVersion})`,
    snapshot: {
      assignment: existing,
      questions: existingQuestionsRes.data ?? [],
    },
  });

  const priorAudit = Array.isArray(existing.audit_history) ? existing.audit_history : [];
  const nextAudit = [
    ...priorAudit,
    {
      version: nextVersion,
      editedBy: userId,
      editedAt: nowIso,
      summary: v.changeSummary || "Updated assignment details",
      previousStatus: existing.status,
    },
  ];

  const nextStatus = v.publishNow && existing.status === "DRAFT" ? "PUBLISHED" : String(existing.status);
  const { error: updateErr } = await db
    .from("assignments")
    .update({
      course_id: v.courseId || null,
      manual_course_code: v.courseId ? null : v.manualCourseCode || null,
      manual_course_name: v.courseId ? null : v.manualCourseName || null,
      manual_department: v.courseId ? null : v.manualDepartment || null,
      manual_faculty: v.courseId ? null : v.manualFaculty || null,
      manual_level: v.courseId ? null : v.manualLevel || null,
      course_classification_status: v.courseId ? "CATALOG" : "MANUAL_UNVERIFIED",
      title: v.title,
      description: v.description || null,
      instructions: v.instructions || null,
      learning_objectives: v.learningObjectives || null,
      academic_session: v.academicSession || null,
      semester: v.semester || null,
      class_group: v.classGroup || null,
      category: v.category,
      status: nextStatus,
      opens_at: v.opensAt || null,
      due_at: v.dueAt || null,
      closes_at: v.closesAt || null,
      published_at: nextStatus === "PUBLISHED" && !existing.published_at ? nowIso : existing.published_at,
      max_attempts: v.maxAttempts,
      late_policy: v.latePolicy,
      late_penalty_percent: v.latePenaltyPercent,
      allowed_formats: v.allowedFormats,
      max_upload_mb: v.maxUploadMb,
      submission_mode: v.submissionMode,
      allow_text_answer: v.allowTextAnswer,
      allow_file_upload: v.allowFileUpload,
      allow_photo_submission: v.allowPhotoSubmission,
      allow_edit_after_submit: v.allowEditAfterSubmit,
      allow_resubmission: v.allowResubmission,
      marking_mode: v.markingMode,
      total_marks: v.totalMarks,
      release_marks_immediately: v.releaseMarksImmediately,
      edited_by: userId,
      edited_at: nowIso,
      audit_history: nextAudit,
      updated_at: nowIso,
    })
    .eq("id", v.assignmentId)
    .eq("organization_id", membership.businessId);

  if (updateErr) {
    return { ok: false as const, error: "Could not update assignment." };
  }

  // Replace questions & answer keys cleanly without touching submissions/payments
  await db.from("answer_keys").delete().eq("assignment_id", v.assignmentId).eq("organization_id", membership.businessId);
  await db.from("assignment_questions").delete().eq("assignment_id", v.assignmentId).eq("organization_id", membership.businessId);

  for (let i = 0; i < activeQuestions.length; i += 1) {
    const q = activeQuestions[i];
    const { data: qRow } = await db
      .from("assignment_questions")
      .insert({
        organization_id: membership.businessId,
        assignment_id: v.assignmentId,
        position: i + 1,
        question_type: q.questionType,
        prompt: q.prompt.trim(),
        description: q.description || null,
        formula_latex: q.formulaLatex || null,
        options: q.options,
        marks: q.marks,
        negative_marks: q.negativeMarks,
        partial_credit: q.partialCredit,
      })
      .select("id")
      .single();

    if (qRow?.id) {
      await db.from("answer_keys").insert({
        organization_id: membership.businessId,
        assignment_id: v.assignmentId,
        question_id: qRow.id,
        accepted_answers: q.acceptedAnswers,
        model_answer: q.modelAnswer || null,
        expected_formula: q.expectedFormula || null,
        expected_unit: q.expectedUnit || null,
        numeric_tolerance: q.numericTolerance,
        case_sensitive: q.caseSensitive,
      });
    }
  }

  // Notify affected recipients if published and material fields changed
  const materialChange =
    existing.status === "PUBLISHED" &&
    v.notifyStudents &&
    (existing.due_at !== (v.dueAt || null) ||
      existing.title !== v.title ||
      existing.instructions !== (v.instructions || null));

  if (materialChange) {
    try {
      await db.from("workspace_notifications").insert({
        business_id: membership.businessId,
        type: "assignment_updated",
        title: `Assignment updated: ${v.title}`,
        message: v.changeSummary || "Assignment instructions or deadline were updated. Review before submitting.",
        href: `/dashboard/academic/student/assignments/${v.assignmentId}`,
      });
    } catch {
      // Non-blocking notification
    }
  }

  revalidatePath("/dashboard/academic");
  revalidatePath("/dashboard/academic/assignments");
  revalidatePath(`/dashboard/academic/assignments/${v.assignmentId}`);
  return { ok: true as const, assignmentId: v.assignmentId };
}

export async function archiveAssignmentAction(assignmentId: string) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  const parsed = archiveAssignmentSchema.safeParse({ assignmentId });
  if (!parsed.success) return { ok: false as const, error: "Invalid assignment." };

  const userId = await requireUserId();
  const nowIso = new Date().toISOString();
  const db = academicDb();
  const { error } = await db
    .from("assignments")
    .update({
      status: "ARCHIVED",
      archived_at: nowIso,
      edited_by: userId,
      edited_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", parsed.data.assignmentId)
    .eq("organization_id", membership.businessId);

  if (error) return { ok: false as const, error: "Could not archive assignment." };
  revalidatePath("/dashboard/academic/assignments");
  revalidatePath(`/dashboard/academic/assignments/${parsed.data.assignmentId}`);
  return { ok: true as const };
}

export async function restoreAssignmentAction(assignmentId: string) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  const parsed = archiveAssignmentSchema.safeParse({ assignmentId });
  if (!parsed.success) return { ok: false as const, error: "Invalid assignment." };

  const userId = await requireUserId();
  const nowIso = new Date().toISOString();
  const db = academicDb();
  const { data: existing } = await db
    .from("assignments")
    .select("published_at")
    .eq("id", parsed.data.assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: "Assignment not found." };
  const restoredStatus = existing.published_at ? "PUBLISHED" : "DRAFT";

  const { error } = await db
    .from("assignments")
    .update({
      status: restoredStatus,
      archived_at: null,
      deleted_at: null,
      edited_by: userId,
      edited_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", parsed.data.assignmentId)
    .eq("organization_id", membership.businessId);

  if (error) return { ok: false as const, error: "Could not restore assignment." };
  revalidatePath("/dashboard/academic/assignments");
  revalidatePath(`/dashboard/academic/assignments/${parsed.data.assignmentId}`);
  return { ok: true as const };
}

export async function deleteAssignmentAction(input: { assignmentId: string; confirmed: boolean }) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  const parsed = deleteAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Deletion confirmation required." };
  }

  const { assignmentId } = parsed.data;
  const userId = await requireUserId();
  const db = academicDb();

  const { data: existing } = await db
    .from("assignments")
    .select("id,created_by")
    .eq("id", assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: "Assignment not found." };
  const isPrivileged = ["owner", "admin", "manager"].includes(membership.role);
  if (!isPrivileged && existing.created_by && existing.created_by !== userId) {
    return { ok: false as const, error: "Only the assignment creator or an administrator can delete this assignment." };
  }

  // Check protected student submissions, payments, grades, and ledger records
  const [subsRes, paymentsRes] = await Promise.all([
    db.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("assignment_id", assignmentId),
    db.from("assignment_payments").select("id", { count: "exact", head: true }).eq("assignment_id", assignmentId),
  ]);

  const hasProtectedRecords = (subsRes.count ?? 0) > 0 || (paymentsRes.count ?? 0) > 0;
  const nowIso = new Date().toISOString();

  // Always soft-delete / archive when submissions or payments exist to preserve financial & academic evidence
  const { error } = await db
    .from("assignments")
    .update({
      status: "ARCHIVED",
      archived_at: nowIso,
      deleted_at: nowIso,
      edited_by: userId,
      edited_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", assignmentId)
    .eq("organization_id", membership.businessId);

  if (error) return { ok: false as const, error: "Could not delete assignment." };
  revalidatePath("/dashboard/academic/assignments");
  return {
    ok: true as const,
    preservedEvidence: hasProtectedRecords,
    message: hasProtectedRecords
      ? "Assignment has existing student submissions or payment records. It was safely archived and hidden while preserving all academic and financial records."
      : "Assignment deleted safely.",
  };
}

export async function getAssignmentShareLinkAction(assignmentId: string) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) return { ok: false as const, error: "Not authorized." };
  if (!z.uuid().safeParse(assignmentId).success) return { ok: false as const, error: "Invalid assignment." };

  const db = academicDb();
  const { data: existing } = await db
    .from("assignments")
    .select("id,title,status,due_at")
    .eq("id", assignmentId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: "Assignment not found." };

  const defaultExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const dueExpiry = existing.due_at ? Math.floor(new Date(String(existing.due_at)).getTime() / 1000) + 60 * 60 * 24 * 7 : defaultExpiry;
  const exp = Math.max(defaultExpiry, dueExpiry);
  const token = signAssignmentGuestToken(membership.businessId, assignmentId, exp);

  return {
    ok: true as const,
    guestPath: `/submit/assignment?token=${encodeURIComponent(token)}`,
    studentPortalPath: `/dashboard/academic/student/assignments/${assignmentId}`,
    status: String(existing.status ?? "DRAFT"),
  };
}
