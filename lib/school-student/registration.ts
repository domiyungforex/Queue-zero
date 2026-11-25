"use server";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { attendanceSecret } from "@/lib/qr/secret";
import { issueIdentityTicket, readIdentityTicket } from "@/lib/school/identity-ticket";
import { decodeAttendancePhoto } from "@/lib/school/photo-quality";
import { profileObjectKey } from "@/lib/storage/keys";
import { deletePrivateImage, storePrivateImage } from "@/lib/storage/store-image";
import { r2SignedGet, readR2Settings } from "@/lib/storage/r2";

const orgId = z.uuid();

function deviceHash(organizationId: string, deviceId: string) {
  return createHash("sha256").update(`${organizationId}:${deviceId}`).digest("hex");
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;

function asRpc(client: { rpc: unknown }) {
  return client.rpc as Rpc;
}

export async function loadRegistrationDirectory(organizationId: string) {
  const parsed = orgId.safeParse(organizationId);
  if (!parsed.success) return { ok: false as const, message: "Ask your institution for its registration link." };
  const db = createJoinSupabaseClient();
  const result = await asRpc(db)("school_public_directory", { p_organization_id: parsed.data });
  const body = z.object({
    ok: z.boolean(),
    message: z.string().optional(),
    institution: z.string().optional(),
    faculties: z.array(z.object({ id: z.uuid(), name: z.string() })).optional(),
    departments: z.array(z.object({ id: z.uuid(), faculty_id: z.uuid(), name: z.string() })).optional(),
  }).safeParse(result.data);
  if (result.error || !body.success || !body.data.ok) {
    return { ok: false as const, message: body.success ? body.data.message ?? "Registration is unavailable." : "Registration is unavailable until the institution update is applied." };
  }
  return { ok: true as const, institution: body.data.institution ?? "Institution", faculties: body.data.faculties ?? [], departments: body.data.departments ?? [] };
}

const registerSchema = z.object({
  organizationId: orgId,
  fullName: z.string().trim().min(1).max(160),
  matricNumber: z.string().trim().min(1).max(80),
  facultyId: orgId,
  departmentId: orgId,
  level: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(254).or(z.literal("")),
  phone: z.string().trim().max(20),
  consent: z.literal("yes"),
  photo: z.string().min(100).max(3_000_000),
});

export async function registerStudent(form: FormData) {
  const emailVal = form.get("email");
  const phoneVal = form.get("phone");
  const parsed = registerSchema.safeParse({
    organizationId: form.get("organizationId"),
    fullName: form.get("fullName"),
    matricNumber: form.get("matricNumber"),
    facultyId: form.get("facultyId"),
    departmentId: form.get("departmentId"),
    level: form.get("level"),
    email: emailVal ? String(emailVal).trim() : "",
    phone: phoneVal ? String(phoneVal).trim() : "",
    consent: form.get("consent"),
    photo: form.get("photo"),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const missing: string[] = [];
    if (issues.some((i) => i.path.includes("fullName"))) missing.push("Full Name");
    if (issues.some((i) => i.path.includes("matricNumber"))) missing.push("Matriculation Number");
    if (issues.some((i) => i.path.includes("facultyId"))) missing.push("Faculty");
    if (issues.some((i) => i.path.includes("departmentId"))) missing.push("Department");
    if (issues.some((i) => i.path.includes("level"))) missing.push("Academic Level");
    if (issues.some((i) => i.path.includes("consent"))) missing.push("Consent Checkbox");
    if (issues.some((i) => i.path.includes("photo"))) missing.push("Reference Photograph");
    if (issues.some((i) => i.path.includes("email"))) missing.push("Valid Email Format");
    const detail = missing.length ? ` Please provide: ${missing.join(", ")}.` : "";
    return { ok: false as const, message: `Check required fields.${detail}` };
  }
  const cleanEmail = parsed.data.email || null;
  const cleanPhone = parsed.data.phone || null;
  if (!cleanEmail && !cleanPhone) {
    return { ok: false as const, message: "Provide an email address or a phone number for communication." };
  }
  const photo = decodeAttendancePhoto(parsed.data.photo);
  if (!photo.ok) return { ok: false as const, message: photo.message };
  const db = createJoinSupabaseClient();
  const fileId = randomUUID();
  const path = profileObjectKey(parsed.data.organizationId, fileId, photo.ext);
  const stored = await storePrivateImage(db, { key: path, body: photo.buffer, type: photo.mime });
  if (!stored.ok) return { ok: false as const, message: "The photograph could not be stored. Registration was not saved." };
  const result = await asRpc(db)("school_register_student", {
    p_organization_id: parsed.data.organizationId,
    p_full_name: parsed.data.fullName,
    p_matric_number: parsed.data.matricNumber,
    p_faculty_id: parsed.data.facultyId,
    p_department_id: parsed.data.departmentId,
    p_level: parsed.data.level,
    p_email: cleanEmail,
    p_phone: cleanPhone,
    p_consent: true,
    p_photo_path: path,
  });
  const body = z.object({ ok: z.boolean(), message: z.string(), matric_number: z.string().optional(), code: z.string().optional() }).safeParse(result.data);
  if (result.error || !body.success || !body.data.ok) {
    await deletePrivateImage(db, path, stored.provider);
    return { ok: false as const, message: body.success ? body.data.message : "Registration could not be saved.", matricNumber: body.success ? body.data.matric_number : undefined };
  }
  return { ok: true as const, message: body.data.message, matricNumber: body.data.matric_number };
}

export async function identifyStudent(organizationId: string, matricNumber: string, deviceId: string) {
  const parsed = z.object({ organizationId: orgId, matricNumber: z.string().trim().min(1).max(80), deviceId: z.string().min(8).max(80) }).safeParse({ organizationId, matricNumber, deviceId });
  if (!parsed.success) return { ok: false as const, message: "Enter the matriculation number issued by your institution." };
  const db = createJoinSupabaseClient();
  const result = await asRpc(db)("school_identify_student", {
    p_organization_id: parsed.data.organizationId,
    p_matric_number: parsed.data.matricNumber,
    p_device_hash: deviceHash(parsed.data.organizationId, parsed.data.deviceId),
  });
  const body = z.object({
    ok: z.boolean(),
    message: z.string().optional(),
    student_id: z.uuid().optional(),
    full_name: z.string().optional(),
    matric_number: z.string().optional(),
    faculty: z.string().optional(),
    department: z.string().optional(),
    level: z.string().optional(),
    has_photo: z.boolean().optional(),
    photo_path: z.string().nullable().optional(),
    sessions: z.array(z.object({
      id: z.uuid(),
      code: z.string(),
      title: z.string(),
      session_title: z.string().nullable(),
      starts_at: z.string().nullable(),
      location_required: z.boolean().optional(),
      location_lat: z.number().nullable().optional(),
      location_lng: z.number().nullable().optional(),
      geofence_radius_meters: z.number().nullable().optional(),
    })).optional(),
  }).safeParse(result.data);
  if (result.error || !body.success || !body.data.ok || !body.data.student_id) {
    return { ok: false as const, message: body.success ? body.data.message ?? "No active attendance session was found for that matriculation number." : "Attendance identification is unavailable." };
  }
  const sessions = body.data.sessions ?? [];
  let photoUrl: string | null = null;
  if (body.data.photo_path) {
    const signed = await db.storage.from("attendance-photos").createSignedUrl(body.data.photo_path, 300);
    photoUrl = signed.data?.signedUrl ?? null;
    if (!photoUrl && readR2Settings()) photoUrl = await r2SignedGet(body.data.photo_path, 300);
  }
  return {
    ok: true as const,
    ticket: issueIdentityTicket({ org: parsed.data.organizationId, student: body.data.student_id, classes: sessions.map((session) => session.id) }, attendanceSecret()),
    fullName: body.data.full_name ?? "",
    matricNumber: body.data.matric_number ?? "",
    faculty: body.data.faculty ?? "",
    department: body.data.department ?? "",
    level: body.data.level ?? "",
    photoUrl,
    sessions: sessions.map(({ id, code, title, session_title, starts_at, location_required, location_lat, location_lng, geofence_radius_meters }) => ({
      id,
      code,
      title,
      sessionTitle: session_title,
      startsAt: starts_at,
      locationRequired: Boolean(location_required && location_lat != null && location_lng != null),
      latitude: location_lat ?? null,
      longitude: location_lng ?? null,
      radiusMeters: geofence_radius_meters ?? null,
    })),
  };
}

export async function recordIdentifiedAttendance(input: {
  ticket: string;
  classId: string;
  deviceId: string;
  photo?: string;
  method: "LIVE_PHOTO" | "MANUAL_DECLARED";
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  capturedAt?: string | null;
}) {
  let ticket;
  try {
    ticket = readIdentityTicket(input.ticket, attendanceSecret());
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Restart identification." };
  }
  const classId = orgId.safeParse(input.classId);
  if (!classId.success || !ticket.classes.includes(classId.data)) {
    return { ok: false as const, message: input.method === "LIVE_PHOTO" ? "Choose one of the open sessions for this institution." : "There is no active session to confirm." };
  }
  const db = createJoinSupabaseClient();
  let photoPath: string | null = null;
  let photoProvider: "r2" | "supabase" | null = null;
  if (input.method === "LIVE_PHOTO") {
    const photo = decodeAttendancePhoto(input.photo ?? "");
    if (!photo.ok) return { ok: false as const, message: photo.message };
    const fileId = randomUUID();
    photoPath = `checks/${ticket.org}/${classId.data}/${fileId}.${photo.ext}`;
    const stored = await storePrivateImage(db, { key: photoPath, body: photo.buffer, type: photo.mime });
    if (!stored.ok) return { ok: false as const, message: "The live photograph could not be stored. Attendance was not recorded." };
    photoProvider = stored.provider;
  }
  const result = await asRpc(db)("school_record_identified_attendance", {
    p_organization_id: ticket.org,
    p_student_id: ticket.student,
    p_class_id: classId.data,
    p_photo_path: photoPath,
    p_method: input.method,
    p_device_hash: deviceHash(ticket.org, input.deviceId),
    p_location_lat: input.latitude ?? null,
    p_location_lng: input.longitude ?? null,
    p_location_accuracy_meters: input.accuracy ?? null,
    p_location_captured_at: input.capturedAt ?? null,
  });
  const body = z.object({
    ok: z.boolean(),
    message: z.string(),
    status: z.string().optional(),
    course_code: z.string().optional(),
    course_title: z.string().optional(),
    verification_status: z.string().optional(),
  }).safeParse(result.data);
  if (result.error || !body.success || !body.data.ok) {
    if (photoPath && photoProvider) await deletePrivateImage(db, photoPath, photoProvider);
    return { ok: false as const, message: body.success ? body.data.message : "Attendance was not recorded." };
  }
  return { ok: true as const, message: body.data.message, status: body.data.status ?? "PRESENT", courseCode: body.data.course_code ?? "", courseTitle: body.data.course_title ?? "", verificationStatus: body.data.verification_status ?? "" };
}

export async function correctStudentProfile(_previous: { ok: boolean; message: string }, form: FormData) {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") return { ok: false, message: "Only an owner or administrator can correct a student profile." };
  const parsed = z.object({
    student_id: orgId,
    full_name: z.string().trim().min(1).max(160),
    matric_number: z.string().trim().min(1).max(80),
    department_id: orgId,
    level: z.string().trim().min(1).max(40),
    phone: z.string().trim().max(20),
  }).safeParse({
    student_id: form.get("student_id"),
    full_name: form.get("full_name"),
    matric_number: form.get("matric_number"),
    department_id: form.get("department_id"),
    level: form.get("level"),
    phone: form.get("phone") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Check the student details and try again." };
  const db = await createUserSupabaseClient();
  const result = await asRpc(db)("school_correct_student", { p_organization_id: membership.businessId, p_payload: parsed.data });
  const body = z.object({ ok: z.boolean(), message: z.string() }).safeParse(result.data);
  if (result.error || !body.success) return { ok: false, message: "Student details could not be updated." };
  return { ok: body.data.ok, message: body.data.message };
}

export async function saveCourseAudience(_previous: { ok: boolean; message: string }, form: FormData) {
  const membership = await requireBusinessMembership();
  const courseId = orgId.safeParse(form.get("course_id"));
  const departments = form.getAll("department_id").map(String).filter((value) => orgId.safeParse(value).success);
  const level = z.string().trim().max(40).parse(String(form.get("level") ?? ""));
  if (!courseId.success || departments.length === 0) return { ok: false, message: "Select the course and at least one department." };
  const db = await createUserSupabaseClient();
  const result = await asRpc(db)("school_set_course_audience", {
    p_organization_id: membership.businessId,
    p_course_id: courseId.data,
    p_department_ids: departments,
    p_level: level,
  });
  const body = z.object({ ok: z.boolean(), message: z.string() }).safeParse(result.data);
  if (result.error || !body.success) return { ok: false, message: "The course audience could not be saved." };
  return { ok: body.data.ok, message: body.data.message };
}
