import { z } from "zod";
const id = z.uuid();
const text = z.string();
const timestamp = z.string().nullable();
export const schoolSnapshotSchema = z.object({
  organization: z.object({ id, name: text, mode: z.enum(["BUSINESS", "SCHOOL", "HYBRID"]) }),
  faculties: z.array(z.object({ id, name: text })),
  departments: z.array(z.object({ id, faculty_id: id, name: text })),
  courses: z.array(z.object({ id, department_id: id, code: text, title: text })),
  students: z.array(z.object({ id, full_name: text, matric_number: text, department_id: id, level: text, programme: text.nullable().optional() })),
  enrollments: z.array(z.object({ course_id: id, student_id: id })),
  lecturers: z.array(z.object({ course_id: id, clerk_user_id: text, display_name: text })),
  classes: z.array(z.object({ id, course_id: id, status: text, starts_at: timestamp, ends_at: timestamp, planned_ends_at: timestamp.optional(), late_after_minutes: z.number(), checkout_enabled: z.boolean(), arrival_open: z.boolean(), departure_required: z.boolean(), verification_mode: z.enum(["STANDARD", "VERIFIED"]).default("VERIFIED"), title: text.nullable().optional(), location_lat: z.number().nullable().optional(), location_lng: z.number().nullable().optional(), geofence_radius_meters: z.number().nullable().optional() })),
  attendance: z.array(z.object({ id, class_session_id: id, student_id: id, check_in_at: timestamp, check_out_at: timestamp, status: z.enum(["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "INCOMPLETE", "EXCUSED", "FLAGGED"]), flag_reason: text.nullable(), submitted_name: text.nullable().optional(), submitted_matric_number: text.nullable().optional(), photo_url: text.nullable().optional(), location_lat: z.number().nullable().optional(), location_lng: z.number().nullable().optional(), location_accuracy_meters: z.number().nullable().optional(), location_verified: z.boolean().optional(), verification_mode: z.enum(["STANDARD", "VERIFIED"]).optional() })),
  flags: z.array(z.object({ id, class_session_id: id, student_id: id, reason: text, created_at: text, resolved_at: timestamp, resolution: text.nullable() })),
});
export type SchoolSnapshot = z.infer<typeof schoolSnapshotSchema>;
export type SchoolActionState = { ok: boolean; message: string; id?: string };
export function schoolTime(value: string | null) { return value ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) + " UTC" : "—"; }

export function attendanceIsLate(row: SchoolSnapshot["attendance"][number], classes: SchoolSnapshot["classes"]) { const session = classes.find(item => item.id === row.class_session_id); return !!(row.check_in_at && session?.starts_at && Date.parse(row.check_in_at) > Date.parse(session.starts_at) + session.late_after_minutes * 60_000); }
