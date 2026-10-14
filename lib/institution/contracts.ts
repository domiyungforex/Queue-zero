import { z } from "zod";
export const INSTITUTION_TYPES = ["UNIVERSITY", "POLYTECHNIC", "COLLEGE", "SECONDARY_SCHOOL", "TRAINING_INSTITUTION", "OTHER"] as const;
export const UNIT_TYPES = ["FACULTY", "DEPARTMENT", "MEDICAL_CENTER", "COUNSELING_CENTER", "BURSARY", "ADMISSIONS", "STUDENT_AFFAIRS", "ICT", "LIBRARY", "ADMINISTRATION", "CUSTOM"] as const;
export const PERMISSIONS = ["unit.manage", "unit.staff.manage", "queue.create", "queue.manage", "queue.serve", "course.create", "course.manage", "attendance.start", "attendance.manage", "attendance.export", "appointments.create", "appointments.manage", "reports.view"] as const;
export const unitSchema = z.object({ id: z.uuid(), parent_unit_id: z.uuid().nullable(), name: z.string(), type: z.enum(UNIT_TYPES), slug: z.string(), status: z.enum(["active", "archived"]), permissions: z.array(z.string()) });
export const institutionSnapshotSchema = z.object({
 organization: z.object({ id: z.uuid(), name: z.string(), institution_type: z.enum(INSTITUTION_TYPES) }),
 units: z.array(unitSchema),
 members: z.array(z.object({ id: z.uuid(), clerk_user_id: z.string(), role: z.string() })),
 assignments: z.array(z.object({ unit_id: z.uuid(), member_id: z.uuid(), role: z.string(), staff_title: z.string().nullable(), permissions: z.array(z.string()) })),
 queues: z.array(z.object({ id: z.uuid(), unit_id: z.uuid(), name: z.string(), slug: z.string(), status: z.string(), waiting: z.number(), average_wait_seconds: z.number().nullable() })),
 courses: z.array(z.object({ id: z.uuid(), unit_id: z.uuid(), code: z.string(), title: z.string() })),
 summary: z.object({ waiting: z.number(), active_queues: z.number(), classes_running: z.number(), attendance_today: z.number(), units_active: z.number() }),
 invitations: z.array(z.object({ id: z.uuid(), email: z.string(), unit_id: z.uuid(), role: z.string(), status: z.string(), expires_at: z.string() })),
});
export type InstitutionSnapshot = z.infer<typeof institutionSnapshotSchema>;
export type InstitutionUnit = z.infer<typeof unitSchema>;
export function displayKind(value: string) { return value.toLowerCase().replaceAll("_", " "); }
