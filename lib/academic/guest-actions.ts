"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { verifyAssignmentGuestToken } from "./distribution";
import { institutionalMatric, sameInstitutionalMatric } from "@/lib/school/matric";
import {
  DEFAULT_FEE_CONFIG,
  evaluateStudentAllowance,
  type FeeCategory,
  type FeeConfig,
} from "./allowance-ledger";
import { gradeObjectiveSubmission, type ObjectiveQuestionKey } from "./marking";

type DbClient = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col2: string, val2: unknown) => {
          eq: (col3: string, val3: unknown) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          order: (c3: string, opts?: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
        ilike: (col2: string, val2: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        };
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        order: (c3: string, opts?: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null }>;
      };
    };
    insert: (row: unknown) => {
      select: (c: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> };
    } & Promise<{ error: unknown }>;
    upsert: (row: unknown, opts?: { onConflict?: string }) => Promise<{ error: unknown }>;
    update: (row: unknown) => {
      eq: (c: string, v: unknown) => {
        eq: (c2: string, v2: unknown) => Promise<{ error: unknown }>;
      };
    };
  };
};

function getDb() {
  return createJoinSupabaseClient() as unknown as DbClient;
}

export async function loadFeeConfig(organizationId: string): Promise<FeeConfig> {
  const db = getDb();
  const { data } = await db
    .from("submission_fee_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) return DEFAULT_FEE_CONFIG;
  return {
    currency: String(data.currency ?? "NGN"),
    freeAllowanceLimit: Number(data.free_allowance_limit ?? 5),
    standardFeeMinor: Number(data.standard_fee_minor ?? 20000),
    extendedFeeMinor: Number(data.extended_fee_minor ?? 30000),
    specialisedFeeMinor: Number(data.specialised_fee_minor ?? 50000),
    lecturerShareBps: Number(data.lecturer_share_bps ?? 7000),
    referralCommissionBps: Number(data.referral_commission_bps ?? 1000),
    minWithdrawalMinor: Number(data.min_withdrawal_minor ?? 500000),
  };
}

export async function verifyGuestStudentForAssignment(input: {
  token: string;
  matricNumber: string;
  referralCode?: string;
}) {
  try {
    const parsedToken = verifyAssignmentGuestToken(input.token);
    const rawMatric = institutionalMatric(input.matricNumber);
    if (!rawMatric) return { ok: false as const, error: "Enter your matriculation number." };

    const db = getDb();
    // 1. Fast indexed case-insensitive lookup
    const { data: directProfile } = await db
      .from("school_profiles")
      .select("id,matric_number,level,department_id")
      .eq("organization_id", parsedToken.orgId)
      .ilike("matric_number", rawMatric)
      .maybeSingle();

    let profile: Record<string, unknown> | undefined = directProfile ?? undefined;

    if (!profile?.id) {
      // 2. Normalized lookup across institution profiles (handles whitespace/formatting variants)
      const { data: orgProfiles } = await db
        .from("school_profiles")
        .select("id,matric_number,level,department_id")
        .eq("organization_id", parsedToken.orgId)
        .order("matric_number", { ascending: true });

      profile = (orgProfiles ?? []).find((row) =>
        sameInstitutionalMatric(String(row.matric_number ?? ""), rawMatric),
      );
    }

    if (!profile?.id) {
      // Fallback: check students who verified via attendance check-in in this institution
      // Note: attendance_records uses check_in_at (not created_at)
      const { data: attRows } = await db
        .from("attendance_records")
        .select("id,student_id,submitted_name,submitted_matric_number")
        .eq("organization_id", parsedToken.orgId)
        .order("check_in_at", { ascending: false });

      const attMatch = (attRows ?? []).find((row) =>
        sameInstitutionalMatric(String(row.submitted_matric_number ?? ""), rawMatric),
      );

      if (attMatch) {
        if (attMatch.student_id) {
          profile = {
            id: String(attMatch.student_id),
            matric_number: String(attMatch.submitted_matric_number ?? rawMatric),
            level: "",
            department_id: null,
          };
        } else {
          const { data: createdPerson } = await db
            .from("people")
            .insert({
              organization_id: parsedToken.orgId,
              person_type: "STUDENT",
              full_name: String(attMatch.submitted_name ?? rawMatric),
            })
            .select("id")
            .single();

          if (createdPerson?.id) {
            await db.from("school_profiles").insert({
              id: createdPerson.id,
              organization_id: parsedToken.orgId,
              matric_number: String(attMatch.submitted_matric_number ?? rawMatric),
              level: "",
            });
            profile = {
              id: String(createdPerson.id),
              matric_number: String(attMatch.submitted_matric_number ?? rawMatric),
              level: "",
              department_id: null,
            };
          }
        }
      }
    }

    if (!profile?.id) {
      return {
        ok: false as const,
        error: "Matriculation number not found in this institution. Register once or ask your lecturer.",
      };
    }

    const { data: person } = await db
      .from("people")
      .select("full_name,clerk_user_id")
      .eq("id", profile.id)
      .maybeSingle();

    const { data: assignment } = await db
      .from("assignments")
      .select("id,title,course_id,fee_category,status,target_audience,target_level,target_class_session_id")
      .eq("id", parsedToken.assignmentId)
      .eq("organization_id", parsedToken.orgId)
      .maybeSingle();

    if (!assignment || assignment.status !== "PUBLISHED") {
      return { ok: false as const, error: "This assignment is not currently accepting submissions." };
    }

    // Enforce lecturer-selected target audience if configured
    const audience = String(assignment.target_audience ?? "ALL_INSTITUTION");
    if (audience === "COURSE_ENROLLED" && assignment.course_id) {
      const { data: enrolled } = await db
        .from("course_enrollments")
        .select("id")
        .eq("course_id", assignment.course_id)
        .eq("student_id", profile.id)
        .maybeSingle();
      if (!enrolled?.id) {
        return {
          ok: false as const,
          error: "This assignment is restricted to students registered for this course.",
        };
      }
    } else if (audience === "CLASS_ATTENDEES") {
      if (assignment.target_class_session_id) {
        const { data: attended } = await db
          .from("attendance_records")
          .select("id")
          .eq("class_session_id", assignment.target_class_session_id)
          .eq("student_id", profile.id)
          .maybeSingle();
        if (!attended?.id) {
          return {
            ok: false as const,
            error: "This assignment is restricted to students who attended the class session.",
          };
        }
      } else {
        const { data: anyAttendance } = await db
          .from("attendance_records")
          .select("id")
          .eq("organization_id", parsedToken.orgId)
          .eq("student_id", profile.id)
          .order("check_in_at", { ascending: false });
        if (!anyAttendance || anyAttendance.length === 0) {
          return {
            ok: false as const,
            error: "This assignment is restricted to students who attended class.",
          };
        }
      }
    } else if (audience === "DEPARTMENT_LEVEL" && assignment.target_level) {
      const targetLvl = String(assignment.target_level).trim().toLowerCase();
      const studentLvl = String(profile.level ?? "").trim().toLowerCase();
      if (targetLvl && studentLvl && targetLvl !== studentLvl) {
        return {
          ok: false as const,
          error: `This assignment is restricted to ${assignment.target_level} students.`,
        };
      }
    }

    // Record immutable referral attribution if valid code provided (never overwrite existing, never self-refer)
    if (input.referralCode?.trim()) {
      const code = input.referralCode.trim().toUpperCase();
      const { data: refRow } = await db
        .from("referral_codes")
        .select("clerk_user_id,code,is_active")
        .eq("code", code)
        .maybeSingle();

      if (refRow?.is_active && refRow.clerk_user_id && refRow.clerk_user_id !== person?.clerk_user_id) {
        const { data: existingAttr } = await db
          .from("referral_attributions")
          .select("referrer_user_id")
          .eq("organization_id", parsedToken.orgId)
          .eq("student_id", profile.id)
          .maybeSingle();

        if (!existingAttr) {
          await db.from("referral_attributions").insert({
            organization_id: parsedToken.orgId,
            student_id: profile.id,
            referrer_user_id: refRow.clerk_user_id,
            referral_code: refRow.code,
          });
        }
      }
    }

    // Mark recipient accessed
    await db
      .from("assignment_recipients")
      .update({ accessed_at: new Date().toISOString() })
      .eq("assignment_id", parsedToken.assignmentId)
      .eq("student_id", profile.id);

    const [allowanceRes, paidRes, config] = await Promise.all([
      db
        .from("student_submission_allowances")
        .select("free_used,sponsored_credits")
        .eq("organization_id", parsedToken.orgId)
        .eq("student_id", profile.id)
        .maybeSingle(),
      db
        .from("assignment_payments")
        .select("id,status")
        .eq("assignment_id", parsedToken.assignmentId)
        .eq("student_id", profile.id)
        .eq("status", "PAID")
        .maybeSingle(),
      loadFeeConfig(parsedToken.orgId),
    ]);

    const allowance = evaluateStudentAllowance({
      freeUsed: Number(allowanceRes.data?.free_used ?? 0),
      sponsoredCredits: Number(allowanceRes.data?.sponsored_credits ?? 0),
      hasPaidCreditForAssignment: Boolean(paidRes.data?.id),
      feeCategory: (String(assignment.fee_category ?? "STANDARD") as FeeCategory),
      config,
    });

    return {
      ok: true as const,
      student: {
        id: String(profile.id),
        fullName: String(person?.full_name ?? "Student"),
        matricNumber: String(profile.matric_number),
        level: String(profile.level ?? ""),
      },
      allowance,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not verify student.",
    };
  }
}

export async function submitGuestAssignmentAction(input: {
  token: string;
  studentId: string;
  requestId: string;
  textContent: string;
  answers: Record<string, unknown>;
  files: Array<{ fileName: string; mimeType: string; sizeBytes: number; storagePath: string; pageOrder: number }>;
}) {
  try {
    const parsedToken = verifyAssignmentGuestToken(input.token);
    if (!z.uuid().safeParse(input.studentId).success || !z.uuid().safeParse(input.requestId).success) {
      return { ok: false as const, error: "Invalid submission request." };
    }

    const db = getDb();
    const { data: assignment } = await db
      .from("assignments")
      .select("id,status,due_at,closes_at,late_policy,fee_category,release_marks_immediately")
      .eq("id", parsedToken.assignmentId)
      .eq("organization_id", parsedToken.orgId)
      .maybeSingle();

    if (!assignment || assignment.status !== "PUBLISHED") {
      return { ok: false as const, error: "This assignment is closed." };
    }

    // Check idempotent replay first
    const { data: replay } = await db
      .from("assignment_submissions")
      .select("id,submission_reference,submitted_at,is_late")
      .eq("assignment_id", parsedToken.assignmentId)
      .eq("request_id", input.requestId)
      .maybeSingle();

    if (replay?.id) {
      return {
        ok: true as const,
        submissionId: String(replay.id),
        reference: String(replay.submission_reference),
        submittedAt: String(replay.submitted_at),
        isLate: Boolean(replay.is_late),
      };
    }

    const [allowanceRes, paidRes, config] = await Promise.all([
      db
        .from("student_submission_allowances")
        .select("free_used,sponsored_credits")
        .eq("organization_id", parsedToken.orgId)
        .eq("student_id", input.studentId)
        .maybeSingle(),
      db
        .from("assignment_payments")
        .select("id,status")
        .eq("assignment_id", parsedToken.assignmentId)
        .eq("student_id", input.studentId)
        .eq("status", "PAID")
        .maybeSingle(),
      loadFeeConfig(parsedToken.orgId),
    ]);

    const allowance = evaluateStudentAllowance({
      freeUsed: Number(allowanceRes.data?.free_used ?? 0),
      sponsoredCredits: Number(allowanceRes.data?.sponsored_credits ?? 0),
      hasPaidCreditForAssignment: Boolean(paidRes.data?.id),
      feeCategory: String(assignment.fee_category ?? "STANDARD") as FeeCategory,
      config,
    });

    if (allowance.requiresPayment) {
      return {
        ok: false as const,
        error: "Free submission allowance exhausted. Complete payment before submitting.",
      };
    }

    // Objective auto-marking
    const [{ data: qRows }, { data: keyRows }] = await Promise.all([
      db
        .from("assignment_questions")
        .select("id,question_type,marks,negative_marks,partial_credit")
        .eq("assignment_id", parsedToken.assignmentId)
        .order("position", { ascending: true }),
      db
        .from("answer_keys")
        .select("question_id,accepted_answers,model_answer,expected_unit,numeric_tolerance,case_sensitive")
        .eq("assignment_id", parsedToken.assignmentId)
        .order("created_at", { ascending: true }),
    ]);

    const keyMap = new Map((keyRows ?? []).map((k) => [String(k.question_id), k]));
    const keys: ObjectiveQuestionKey[] = (qRows ?? []).map((q) => {
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

    const autoEval = gradeObjectiveSubmission(keys, input.answers);
    const now = new Date();
    const dueAt = assignment.due_at ? new Date(String(assignment.due_at)) : null;
    const isLate = Boolean(dueAt && now > dueAt);
    const submittedAt = now.toISOString();
    const ref = `SUB-${randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: created, error } = await db
      .from("assignment_submissions")
      .insert({
        organization_id: parsedToken.orgId,
        assignment_id: parsedToken.assignmentId,
        student_id: input.studentId,
        submission_reference: ref,
        request_id: input.requestId,
        status: !autoEval.hasSubjective && keys.length > 0 ? "AUTO_MARKED" : isLate ? "LATE" : "SUBMITTED",
        attempt_number: 1,
        text_content: input.textContent,
        answers_json: input.answers,
        is_late: isLate,
        submitted_at: submittedAt,
        auto_score: autoEval.totalAutoScore,
        final_score: !autoEval.hasSubjective && keys.length > 0 ? autoEval.totalAutoScore : null,
        grade_released: !autoEval.hasSubjective && Boolean(assignment.release_marks_immediately),
      })
      .select("id")
      .single();

    if (error || !created?.id) {
      return { ok: false as const, error: "Could not persist submission (or duplicate submission detected)." };
    }

    const submissionId = String(created.id);
    for (const f of input.files) {
      await db.from("submission_files").insert({
        organization_id: parsedToken.orgId,
        submission_id: submissionId,
        file_name: f.fileName,
        mime_type: f.mimeType,
        size_bytes: f.sizeBytes,
        storage_path: f.storagePath,
        page_order: f.pageOrder,
        is_handwritten: f.mimeType.startsWith("image/"),
        immutable_at: submittedAt,
      });
    }

    // Consume free allowance or sponsored credit ONLY after submission succeeds
    if (allowance.paymentSource === "FREE_ALLOWANCE") {
      await db.from("student_submission_allowances").upsert(
        {
          organization_id: parsedToken.orgId,
          student_id: input.studentId,
          free_used: Number(allowanceRes.data?.free_used ?? 0) + 1,
          sponsored_credits: Number(allowanceRes.data?.sponsored_credits ?? 0),
          updated_at: submittedAt,
        },
        { onConflict: "organization_id,student_id" },
      );
    } else if (allowance.paymentSource === "SPONSORED_CREDIT") {
      await db.from("student_submission_allowances").upsert(
        {
          organization_id: parsedToken.orgId,
          student_id: input.studentId,
          free_used: Number(allowanceRes.data?.free_used ?? 0),
          sponsored_credits: Math.max(0, Number(allowanceRes.data?.sponsored_credits ?? 0) - 1),
          updated_at: submittedAt,
        },
        { onConflict: "organization_id,student_id" },
      );
    } else if (allowance.paymentSource === "PAID_CREDIT" && paidRes.data?.id) {
      await db
        .from("assignment_payments")
        .update({ consumed_submission_id: submissionId })
        .eq("id", paidRes.data.id)
        .eq("organization_id", parsedToken.orgId);
    }

    return {
      ok: true as const,
      submissionId,
      reference: ref,
      submittedAt,
      isLate,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Submission failed.",
    };
  }
}
