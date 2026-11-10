"use server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { schoolInputSchema, parseStudentCsv, parseStudentCsvPreview } from "./validation";
import type { SchoolActionState } from "./contracts";
import { z } from "zod";
import type { Json } from "@/lib/db/database.types";
import { schoolActionErrorMessage } from "./action-errors";

export async function manageSchool(_previous: SchoolActionState, form: FormData): Promise<SchoolActionState> {
  const membership = await requireBusinessMembership();
  if (!membership.institutionType && !["owner", "admin", "lecturer"].includes(membership.role)) return { ok: false, message: "You do not have permission to manage attendance." };
  try {
    const raw: Record<string, unknown> = Object.fromEntries(form.entries());
    if (raw.action === "enroll") raw.students = parseStudentCsv(String(raw.csv ?? ""));
    if (raw.action === "class") { raw.departure_required = false; for (const field of ["starts_at", "planned_ends_at", "attendance_closes_at"]) { const value = String(raw[field] ?? ""); raw[field] = field === "planned_ends_at" && !value ? null : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value + ":00Z" : value; } }
    const parsed = schoolInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "Please check the form fields and try again." };
    const { action, ...fields } = parsed.data;
    if (["faculty", "department", "lecturer", "remove_lecturer"].includes(action) && !membership.institutionType && membership.role === "lecturer") return { ok: false, message: "Only an owner or administrator can change school setup." };
    let payload: Record<string, Json | undefined> = { ...fields, organization_id: membership.businessId };
    if (parsed.data.action === "course" && membership.role === "lecturer") {
      const identity = await currentUser();
      const verifiedEmail = identity?.emailAddresses.find(address => address.verification?.status === "verified")?.emailAddress;
      if (!identity || (!identity.fullName && !verifiedEmail)) return { ok: false, message: "Add your name or verify an email in your account before creating a course." };
      payload.creator_display_name = (identity.fullName || verifiedEmail!).slice(0, 160);
    }
    if (parsed.data.action === "lecturer") {
      const email = parsed.data.email.toLowerCase();
      const client = await clerkClient();
      const users = await client.users.getUserList({ emailAddress: [email], limit: 2 });
      const matched = users.data.filter(user => user.emailAddresses.some(address => address.emailAddress.toLowerCase() === email && address.verification?.status === "verified"));
      if (matched.length !== 1) return { ok: false, message: "Ask this lecturer to create a TuRnMaRk account and verify that email, then try again." };
      payload = { course_id: parsed.data.course_id, user_id: matched[0].id, display_name: matched[0].fullName || email, organization_id: membership.businessId };
    }
    const db = await createUserSupabaseClient();
    const result = action === "class"
      ? await db.rpc("school_create_accountless_class", { p_organization_id: membership.businessId, p_course_id: parsed.data.course_id, p_starts_at: parsed.data.starts_at, p_planned_ends_at: parsed.data.planned_ends_at ?? parsed.data.attendance_closes_at, p_late_after_minutes: parsed.data.late_after_minutes, p_attendance_closes_at: parsed.data.attendance_closes_at, p_verification_mode: parsed.data.verification_mode })
      : action === "revoke_qr"
        ? await db.rpc("school_revoke_qr", { p_organization_id: membership.businessId, p_class_id: parsed.data.class_id }).then(value => ({ ...value, data: value.error ? null : { message: "Class QR revoked." } }))
        : action === "enroll"
          ? await db.rpc("school_import_roster", { p_organization_id: membership.businessId, p_course_id: parsed.data.course_id, p_students: parsed.data.students })
          : await db.rpc("school_manage", { p_action: action, p_payload: payload });
    if (result.error) {
      if (process.env.NODE_ENV !== "production") console.warn("School action failed", { action, code: result.error.code });
      const attendanceAction = ["class", "open", "close_arrival", "finish", "revoke_qr", "resolve_flag"].includes(action);
      return { ok: false, message: attendanceAction ? schoolActionErrorMessage(result.error) : result.error.code === "42501" ? "This record is unavailable or your access has changed." : result.error.code === "23505" ? "This record already exists. Check the course, email or matric number." : "We couldn’t save this change. Try again." };
    }
    const response = z.object({ id: z.uuid().optional(), message: z.string() }).safeParse(result.data);
    if (!response.success) return { ok: false, message: "The response was unavailable. Reload to check before retrying." };
    revalidatePath("/dashboard", "layout");
    return { ok: true, ...response.data };
  } catch (error) {
    unstable_rethrow(error);
    // Validation messages contain row positions, never student PII or provider errors.
    if (error instanceof Error && /^(Import at most|Use the header|Include between|Check the CSV|Check the name|Row \d|Duplicate student)/.test(error.message)) return { ok: false, message: error.message };
    return { ok: false, message: "We couldn’t connect. Try again." };
  }
}

export type RosterImportState = { ok: boolean; message: string; preview?: { valid: number; duplicates: number; invalid: number; existing: number }; imported?: boolean };
export async function importRoster(_previous: RosterImportState, form: FormData): Promise<RosterImportState> {
  const membership = await requireBusinessMembership();
  try {
    const courseId = z.uuid().parse(form.get("course_id"));
    const csv = z.string().max(100_000).parse(form.get("csv"));
    const parsed = parseStudentCsvPreview(csv);
    if (!parsed.valid) return { ok: false, message: "No valid roster rows were found.", preview: { ...parsed, existing: 0 } };
    const db = await createUserSupabaseClient();
    const existingResult = await db.rpc("school_roster_existing", { p_organization_id: membership.businessId, p_course_id: courseId, p_matric_numbers: parsed.students.map(student => student.matric_number) });
    const existing = z.object({ existing: z.number().int().nonnegative() }).safeParse(existingResult.data);
    if (existingResult.error || !existing.success) return { ok: false, message: "The roster preview is unavailable. Check your access and try again." };
    const preview = { valid: parsed.valid, duplicates: parsed.duplicates, invalid: parsed.invalid, existing: existing.data.existing };
    if (form.get("confirm") !== "yes") return { ok: true, message: "Review the validation summary, then confirm the import.", preview };
    if (parsed.duplicates || parsed.invalid) return { ok: false, message: "Fix duplicate and invalid rows before confirming.", preview };
    const result = await db.rpc("school_import_roster", { p_organization_id: membership.businessId, p_course_id: courseId, p_students: parsed.students });
    if (result.error) return { ok: false, message: result.error.code === "42501" ? "This course is unavailable or your access has changed." : "The roster could not be imported. Check names and matric numbers." , preview };
    revalidatePath("/dashboard", "layout");
    return { ok: true, imported: true, message: `${parsed.valid - existing.data.existing} students added; ${existing.data.existing} already enrolled.`, preview };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: error instanceof Error && /^(Import at most|Use required|Include between|Check the CSV)/.test(error.message) ? error.message : "Check the CSV and try again." };
  }
}
