"use server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireUserId } from "@/lib/auth/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { schoolInputSchema, parseStudentCsv, parseStudentCsvPreview } from "./validation";
import type { SchoolActionState } from "./contracts";
import { z } from "zod";
import type { Json } from "@/lib/db/database.types";
import { schoolActionErrorMessage } from "./action-errors";
import { zonedWallTimeToUtc } from "./class-time";
import {
  cancelPendingAttendanceReminders,
  dispatchAttendanceSessionNotifications,
  retryFailedAttendanceNotifications,
  type AttendanceRecipientMode,
} from "./attendance-notifications";

export async function manageSchool(_previous: SchoolActionState, form: FormData): Promise<SchoolActionState> {
  const membership = await requireBusinessMembership();
  if (!membership.institutionType && !["owner", "admin", "lecturer"].includes(membership.role)) return { ok: false, message: "You do not have permission to manage attendance." };
  try {
    const raw: Record<string, unknown> = Object.fromEntries(form.entries());
    if (raw.action === "enroll") raw.students = parseStudentCsv(String(raw.csv ?? ""));
    if (raw.action === "class") {
      raw.departure_required = false;
      const dbForZone = await createUserSupabaseClient();
      const zoneResult = await dbForZone.from("businesses").select("timezone").eq("id", membership.businessId).maybeSingle();
      const orgZone = zoneResult.data?.timezone || "UTC";
      const browserZone = typeof raw.browser_timezone === "string" ? raw.browser_timezone.trim() : "";
      let timeZone = orgZone;
      if (orgZone === "UTC" && browserZone && browserZone !== "UTC") {
        try {
          new Intl.DateTimeFormat("en", { timeZone: browserZone });
          timeZone = browserZone;
        } catch {
          timeZone = orgZone;
        }
      }
      for (const field of ["starts_at", "planned_ends_at", "attendance_closes_at"]) {
        const val = raw[field];
        if (!val || val === "") {
          raw[field] = field === "planned_ends_at" ? null : "";
        } else {
          raw[field] = zonedWallTimeToUtc(String(val).trim(), timeZone);
        }
      }
      if (!raw.title) raw.title = null;
      if (!raw.location_lat || raw.location_lat === "") raw.location_lat = null;
      if (!raw.location_lng || raw.location_lng === "") raw.location_lng = null;
      if (!raw.geofence_radius_meters || raw.geofence_radius_meters === "") raw.geofence_radius_meters = null;
    }
    const parsed = schoolInputSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detailMessage = issue ? issue.message : "Please check the form fields and try again.";
      return { ok: false, message: detailMessage };
    }
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
    let result: { data: unknown; error: { code?: string; message?: string } | null } = { data: null, error: null };

    if (action === "class") {
      // Primary call with all 11 parameters (smart attendance system schema)
      const primaryResult = await db.rpc("school_create_accountless_class", {
        p_organization_id: membership.businessId,
        p_course_id: parsed.data.course_id,
        p_starts_at: parsed.data.starts_at,
        p_planned_ends_at: parsed.data.planned_ends_at ?? parsed.data.attendance_closes_at,
        p_late_after_minutes: parsed.data.late_after_minutes,
        p_attendance_closes_at: parsed.data.attendance_closes_at,
        p_verification_mode: parsed.data.verification_mode,
        p_title: parsed.data.title ?? null,
        p_location_lat: parsed.data.location_lat ?? null,
        p_location_lng: parsed.data.location_lng ?? null,
        p_geofence_radius_meters: parsed.data.geofence_radius_meters ?? 100,
      });

      // If the database has an older RPC signature (e.g. 7 parameters from 20261110030000_smart_attendance_modes.sql
      // or PostgREST schema cache hasn't reloaded the 11-param signature), gracefully fall back:
      const wantsLocation = parsed.data.location_lat != null && parsed.data.location_lng != null;
      if (
        primaryResult.error &&
        wantsLocation &&
        (primaryResult.error.code === "PGRST202" ||
          (primaryResult.error.message && primaryResult.error.message.includes("schema cache")))
      ) {
        return { ok: false, message: "The class location could not be saved, so the session was not created. Apply the attendance location update and try again." };
      }
      if (
        primaryResult.error &&
        !wantsLocation &&
        (primaryResult.error.code === "PGRST202" ||
          (primaryResult.error.message && primaryResult.error.message.includes("schema cache")))
      ) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Retrying school_create_accountless_class with 7-param signature");
        }
        // Fallback 1: 7-param signature (with verification mode)
        const fallback7Result = await (db.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)("school_create_accountless_class", {
          p_organization_id: membership.businessId,
          p_course_id: parsed.data.course_id,
          p_starts_at: parsed.data.starts_at,
          p_planned_ends_at: parsed.data.planned_ends_at ?? parsed.data.attendance_closes_at,
          p_late_after_minutes: parsed.data.late_after_minutes,
          p_attendance_closes_at: parsed.data.attendance_closes_at,
          p_verification_mode: parsed.data.verification_mode,
        });

        if (
          fallback7Result.error &&
          (fallback7Result.error.code === "PGRST202" ||
            (fallback7Result.error.message && fallback7Result.error.message.includes("schema cache")))
        ) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Retrying school_create_accountless_class with 6-param legacy signature");
          }
          // Fallback 2: 6-param legacy signature
          result = await (db.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)("school_create_accountless_class", {
            p_organization_id: membership.businessId,
            p_course_id: parsed.data.course_id,
            p_starts_at: parsed.data.starts_at,
            p_planned_ends_at: parsed.data.planned_ends_at ?? parsed.data.attendance_closes_at,
            p_late_after_minutes: parsed.data.late_after_minutes,
            p_attendance_closes_at: parsed.data.attendance_closes_at,
          });
        } else {
          result = fallback7Result;
        }
      } else {
        result = primaryResult;
      }
    } else if (action === "revoke_qr") {
      result = await db.rpc("school_revoke_qr", { p_organization_id: membership.businessId, p_class_id: parsed.data.class_id }).then(value => ({ ...value, data: value.error ? null : { message: "Class QR revoked." } }));
    } else if (action === "enroll") {
      result = await db.rpc("school_import_roster", { p_organization_id: membership.businessId, p_course_id: parsed.data.course_id, p_students: parsed.data.students });
    } else {
      result = await db.rpc("school_manage", { p_action: action, p_payload: payload });
    }
    if (result.error) {
      if (process.env.NODE_ENV !== "production") console.warn("School action failed", { action, code: result.error.code, message: result.error.message });
      const attendanceAction = ["class", "open", "close_arrival", "finish", "revoke_qr", "resolve_flag"].includes(action);
      return { ok: false, message: attendanceAction ? schoolActionErrorMessage(result.error) : result.error.code === "42501" ? "This record is unavailable or your access has changed." : result.error.code === "23505" ? "This record already exists. Check the course, email or matric number." : "We couldn’t save this change. Try again." };
    }
    const response = z.object({ id: z.uuid().optional(), message: z.string() }).safeParse(result.data);
    if (!response.success) return { ok: false, message: "The response was unavailable. Reload to check before retrying." };
    if (action === "class" && response.data.id) {
      let opened = false;
      try {
        const openRes = await db.rpc("school_manage", {
          p_action: "open",
          p_payload: { class_id: response.data.id, organization_id: membership.businessId },
        });
        opened = !openRes.error;
      } catch {
        // Lecturer can still open via controls if auto-open encounters edge state
      }

      if (opened) {
        try {
          const recipientMode = (typeof raw.recipient_mode === "string"
            ? raw.recipient_mode
            : "COURSE_ENROLLED") as AttendanceRecipientMode;
          const departmentId = typeof raw.notification_department_id === "string" ? raw.notification_department_id : null;
          const level = typeof raw.notification_level === "string" ? raw.notification_level : null;
          const selectedStudentIds =
            typeof raw.notification_student_ids === "string" && raw.notification_student_ids.trim()
              ? raw.notification_student_ids.split(",").map((s) => s.trim()).filter(Boolean)
              : undefined;
          await dispatchAttendanceSessionNotifications({
            organizationId: membership.businessId,
            classSessionId: response.data.id,
            eventType: "SESSION_OPENED",
            recipientMode,
            departmentId,
            level,
            selectedStudentIds,
            venue: typeof raw.venue === "string" ? raw.venue : null,
          });
        } catch {
          // Notification failure must never block attendance session creation or check-in
        }
      }
    } else if (action === "open" && "class_id" in parsed.data) {
      try {
        await dispatchAttendanceSessionNotifications({
          organizationId: membership.businessId,
          classSessionId: String(parsed.data.class_id),
          eventType: "SESSION_REOPENED",
        });
      } catch {
        // Non-blocking
      }
    } else if (action === "finish" && "class_id" in parsed.data) {
      try {
        await cancelPendingAttendanceReminders(String(parsed.data.class_id));
      } catch {
        // Non-blocking
      }
    }
    revalidatePath("/dashboard", "layout");
    return { ok: true, ...response.data };
  } catch (error) {
    unstable_rethrow(error);
    if (process.env.NODE_ENV !== "production") console.warn("manageSchool catch error", error);
    // Validation messages contain row positions, never student PII or provider errors.
    if (error instanceof Error && /^(Import at most|Use the header|Include between|Check the CSV|Check the name|Row \d|Duplicate student)/.test(error.message)) return { ok: false, message: error.message };
    if (error instanceof Error && error.message && !error.message.includes("fetch failed") && !error.message.includes("ENOTFOUND")) {
      return { ok: false, message: schoolActionErrorMessage({ message: error.message }) };
    }
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

export type SchoolDeleteResult = { ok: boolean; message: string };

type UntypedDeleteBuilder = {
  from: (table: string) => {
    delete: () => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => Promise<unknown>;
      };
    };
  };
};

async function deleteSessionChildren(
  db: ReturnType<typeof createJoinSupabaseClient>,
  organizationId: string,
  sessionIds: string[],
) {
  if (sessionIds.length === 0) return;
  await db.from("attendance_scan_requests").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("attendance_qr_nonces").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("attendance_flags").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("attendance_records").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("attendance_device_uses").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("class_roster").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("class_lecturers").delete().in("class_session_id", sessionIds).eq("organization_id", organizationId);
  await db.from("class_sessions").delete().in("id", sessionIds).eq("organization_id", organizationId);
}

export async function deleteCourse(courseId: string): Promise<SchoolDeleteResult> {
  const [membership, userId] = await Promise.all([requireBusinessMembership(), requireUserId()]);
  const parsed = z.string().uuid().safeParse(courseId);
  if (!parsed.success) return { ok: false, message: "Invalid course identifier." };

  const canManageAll =
    Boolean(membership.institutionType) || membership.role === "owner" || membership.role === "admin";
  if (!canManageAll && membership.role !== "lecturer") {
    return { ok: false, message: "You do not have permission to delete courses." };
  }

  const db = createJoinSupabaseClient();
  const { data: course } = await db
    .from("courses")
    .select("id, organization_id, code")
    .eq("id", parsed.data)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!course) return { ok: false, message: "Course not found in this organization." };

  if (!canManageAll && membership.role === "lecturer") {
    const { data: assigned } = await db
      .from("course_lecturers")
      .select("course_id")
      .eq("course_id", course.id)
      .eq("organization_id", membership.businessId)
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (!assigned) {
      return { ok: false, message: "Only an owner, admin, or assigned lecturer can delete this course." };
    }
  }

  const { data: sessions } = await db
    .from("class_sessions")
    .select("id")
    .eq("course_id", course.id)
    .eq("organization_id", membership.businessId);

  await deleteSessionChildren(db, membership.businessId, (sessions ?? []).map((s) => s.id));

  const untyped = db as unknown as UntypedDeleteBuilder;
  await untyped.from("course_audiences").delete().eq("course_id", course.id).eq("organization_id", membership.businessId);
  await db.from("course_students").delete().eq("course_id", course.id).eq("organization_id", membership.businessId);
  await db.from("course_lecturers").delete().eq("course_id", course.id).eq("organization_id", membership.businessId);

  const { error } = await db
    .from("courses")
    .delete()
    .eq("id", course.id)
    .eq("organization_id", membership.businessId);

  if (error) return { ok: false, message: "Course could not be deleted right now. Try again." };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Course ${course.code} and its sessions were deleted.` };
}

export async function deleteStudentProfile(studentId: string): Promise<SchoolDeleteResult> {
  const membership = await requireBusinessMembership();
  const parsed = z.string().uuid().safeParse(studentId);
  if (!parsed.success) return { ok: false, message: "Invalid student identifier." };

  const allowed =
    Boolean(membership.institutionType) || ["owner", "admin", "lecturer"].includes(membership.role);
  if (!allowed) return { ok: false, message: "You do not have permission to delete student profiles." };

  const db = createJoinSupabaseClient();
  const { data: student } = await db
    .from("school_profiles")
    .select("id, organization_id, matric_number")
    .eq("id", parsed.data)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!student) return { ok: false, message: "Student profile not found in this organization." };

  const untyped = db as unknown as UntypedDeleteBuilder;
  await db.from("attendance_scan_requests").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);
  await db.from("attendance_flags").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);
  await db.from("attendance_records").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);
  await db.from("attendance_device_uses").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);
  await untyped.from("student_devices").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);
  await db.from("course_students").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);
  await untyped.from("attendance_identity_lookups").delete().eq("student_id", student.id).eq("organization_id", membership.businessId);

  const { error } = await db
    .from("school_profiles")
    .delete()
    .eq("id", student.id)
    .eq("organization_id", membership.businessId);

  if (error) return { ok: false, message: "Student profile could not be deleted right now. Try again." };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Deleted student profile (${student.matric_number}).` };
}

export async function deleteClassSession(classId: string): Promise<SchoolDeleteResult> {
  const membership = await requireBusinessMembership();
  const parsed = z.string().uuid().safeParse(classId);
  if (!parsed.success) return { ok: false, message: "Invalid class session identifier." };

  const allowed =
    Boolean(membership.institutionType) || ["owner", "admin", "lecturer"].includes(membership.role);
  if (!allowed) return { ok: false, message: "You do not have permission to delete class sessions." };

  const db = createJoinSupabaseClient();
  const { data: session } = await db
    .from("class_sessions")
    .select("id, organization_id")
    .eq("id", parsed.data)
    .eq("organization_id", membership.businessId)
    .maybeSingle();

  if (!session) return { ok: false, message: "Class session not found in this organization." };

  await deleteSessionChildren(db, membership.businessId, [session.id]);

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Class session and its attendance records were deleted." };
}

export async function retryAttendanceNotificationsAction(
  classId: string,
): Promise<{ ok: boolean; message: string }> {
  const membership = await requireBusinessMembership();
  const allowed =
    Boolean(membership.institutionType) || ["owner", "admin", "lecturer"].includes(membership.role);
  if (!allowed) return { ok: false, message: "You do not have permission to retry notifications." };

  const parsed = z.uuid().safeParse(classId);
  if (!parsed.success) return { ok: false, message: "Invalid class session." };

  const result = await retryFailedAttendanceNotifications(membership.businessId, parsed.data);
  revalidatePath(`/dashboard/attendance/${parsed.data}`);
  if (result.retried === 0) {
    return { ok: true, message: "No failed notifications to retry." };
  }
  return {
    ok: true,
    message: `Retried ${result.retried} notification(s): ${result.succeeded} sent, ${result.failed} still failed.`,
  };
}
