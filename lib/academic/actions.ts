"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { createAssignmentSchema } from "./types";
import { computeLetterGrade, gradeObjectiveSubmission, type ObjectiveQuestionKey } from "./marking";
import { analyzeSubmissionSimilarity, assessAiWritingRisk } from "./integrity";

type DbResult<T = unknown> = Promise<{ data: T | null; error: { message?: string } | null }>;

function academicDb() {
  return createJoinSupabaseClient() as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c2: string, v2: unknown) => {
            maybeSingle: () => DbResult<Record<string, unknown>>;
            order: (c3: string, opts?: { ascending: boolean }) => DbResult<Record<string, unknown>[]>;
          };
          maybeSingle: () => DbResult<Record<string, unknown>>;
          order: (c3: string, opts?: { ascending: boolean }) => DbResult<Record<string, unknown>[]>;
        };
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
    };
  };
}

function isStaffRole(role: string) {
  return ["owner", "admin", "manager", "lecturer"].includes(role);
}

export async function createAssignmentAction(input: unknown) {
  const membership = await requireBusinessMembership();
  if (!isStaffRole(membership.role)) {
    return { ok: false as const, error: "Not authorized to create assignments." };
  }

  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid assignment data." };
  }

  const v = parsed.data;
  if (v.publishNow && v.questions.length === 0) {
    return { ok: false as const, error: "Add at least one question before publishing." };
  }

  const userId = await requireUserId();
  const userDb = await createUserSupabaseClient();
  // Verify course belongs to this organization and user has access
  const { data: course } = await userDb
    .from("courses")
    .select("id")
    .eq("id", v.courseId)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!course) {
    return { ok: false as const, error: "Course not found or access denied." };
  }

  const db = academicDb();
  const status = v.publishNow ? "PUBLISHED" : "DRAFT";
  const { data: created, error } = await db
    .from("assignments")
    .insert({
      organization_id: membership.businessId,
      course_id: v.courseId,
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
  for (let i = 0; i < v.questions.length; i += 1) {
    const q = v.questions[i];
    const { data: qRow } = await db
      .from("assignment_questions")
      .insert({
        organization_id: membership.businessId,
        assignment_id: assignmentId,
        position: i + 1,
        question_type: q.questionType,
        prompt: q.prompt,
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
