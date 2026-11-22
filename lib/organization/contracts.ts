import { z } from "zod";

export const cmsOverviewSchema = z.object({
  organization_id: z.string(),
  total_faculties: z.number().default(0),
  total_departments: z.number().default(0),
  total_units: z.number().default(0),
  total_courses: z.number().default(0),
  total_lecturers: z.number().default(0),
  total_students: z.number().default(0),
  total_personnel: z.number().default(0),
  active_sessions: z.number().default(0),
  today_checkins: z.number().default(0),
  total_queues: z.number().default(0),
  total_bookings: z.number().default(0),
});

export type CmsOverview = z.infer<typeof cmsOverviewSchema>;

export const attendanceRecordSchema = z.object({
  id: z.string(),
  class_session_id: z.string(),
  course_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  department_name: z.string(),
  faculty_name: z.string(),
  student_name: z.string(),
  matric_number: z.string().nullable().optional(),
  student_level: z.string().nullable().optional(),
  status: z.string(),
  check_in_at: z.string().nullable().optional(),
  verification_mode: z.string().default("STANDARD"),
  has_photo: z.boolean().default(false),
  has_geofence: z.boolean().default(false),
  lecturer_name: z.string().default("Instructor"),
});

export type CmsAttendanceRecord = z.infer<typeof attendanceRecordSchema>;

export const attendanceOversightSchema = z.object({
  summary: z.object({
    total_recorded: z.number().default(0),
    present_count: z.number().default(0),
    late_count: z.number().default(0),
    flagged_count: z.number().default(0),
    active_classes: z.number().default(0),
  }),
  records: z.array(attendanceRecordSchema),
  departments: z.array(z.object({ id: z.string(), name: z.string() })),
  courses: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      title: z.string(),
      department_id: z.string(),
    })
  ),
});

export type AttendanceOversight = z.infer<typeof attendanceOversightSchema>;
