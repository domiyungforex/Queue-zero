import "server-only";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import {
  cmsOverviewSchema,
  attendanceOversightSchema,
  type CmsOverview,
  type AttendanceOversight,
  type CmsAttendanceRecord,
} from "./contracts";

export { cmsOverviewSchema, attendanceOversightSchema, type CmsOverview, type AttendanceOversight, type CmsAttendanceRecord };

export async function getOrganizationCmsOverview(): Promise<CmsOverview> {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();

  const { data, error } = await db.rpc("get_organization_cms_overview", {
    p_organization_id: membership.businessId,
  });

  if (!error && data) {
    const parsed = cmsOverviewSchema.safeParse(data);
    if (parsed.success) return parsed.data;
  }

  // Graceful fallback querying counts directly
  const [
    { count: totalFaculties },
    { count: totalDepartments },
    { count: totalCourses },
    { count: totalStudents },
    { count: totalPersonnel },
    { count: totalQueues },
    { count: totalBookings },
  ] = await Promise.all([
    db.from("faculties").select("*", { count: "exact", head: true }).eq("organization_id", membership.businessId),
    db.from("departments").select("*", { count: "exact", head: true }).eq("organization_id", membership.businessId),
    db.from("courses").select("*", { count: "exact", head: true }).eq("organization_id", membership.businessId),
    db.from("people").select("*", { count: "exact", head: true }).eq("organization_id", membership.businessId).eq("type", "STUDENT"),
    db.from("business_members").select("*", { count: "exact", head: true }).eq("business_id", membership.businessId),
    db.from("queues").select("*", { count: "exact", head: true }).eq("business_id", membership.businessId),
    db.from("bookings").select("*", { count: "exact", head: true }).eq("organization_id", membership.businessId),
  ]);

  return {
    organization_id: membership.businessId,
    total_faculties: totalFaculties ?? 0,
    total_departments: totalDepartments ?? 0,
    total_units: totalDepartments ?? 0,
    total_courses: totalCourses ?? 0,
    total_lecturers: 0,
    total_students: totalStudents ?? 0,
    total_personnel: totalPersonnel ?? 0,
    active_sessions: 0,
    today_checkins: 0,
    total_queues: totalQueues ?? 0,
    total_bookings: totalBookings ?? 0,
  };
}

export async function getOrganizationAttendanceOversight(params?: {
  departmentId?: string;
  courseId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<AttendanceOversight> {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();

  const { data, error } = await db.rpc("get_organization_attendance_oversight", {
    p_organization_id: membership.businessId,
    p_department_id: params?.departmentId || null,
    p_course_id: params?.courseId || null,
    p_status: params?.status || null,
    p_limit: params?.limit || 100,
    p_offset: params?.offset || 0,
  });

  if (!error && data) {
    const parsed = attendanceOversightSchema.safeParse(data);
    if (parsed.success) return parsed.data;
  }

  return {
    summary: {
      total_recorded: 0,
      present_count: 0,
      late_count: 0,
      flagged_count: 0,
      active_classes: 0,
    },
    records: [],
    departments: [],
    courses: [],
  };
}

export type CourseWithLecturers = {
  id: string;
  code: string;
  title: string;
  department_id: string;
  department_name: string;
  faculty_name: string;
  academic_session?: string | null;
  semester?: string | null;
  status: string;
  enrolled_count: number;
  lecturers: Array<{
    clerk_user_id: string;
    display_name: string;
    role: string;
  }>;
};

export async function getOrganizationCoursesDetailed(): Promise<CourseWithLecturers[]> {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();

  // Fetch courses with department and faculty
  const { data: courses, error } = await db
    .from("courses")
    .select(`
      id,
      code,
      title,
      department_id,
      departments!inner (
        name,
        faculties!inner (
          name
        )
      )
    `)
    .eq("organization_id", membership.businessId)
    .order("code", { ascending: true });

  if (error || !courses) return [];

  // Fetch course lecturers
  const { data: lecturers } = await db
    .from("course_lecturers")
    .select("course_id, clerk_user_id, display_name")
    .eq("organization_id", membership.businessId);

  // Fetch enrollment counts
  const { data: enrollments } = await db
    .from("course_students")
    .select("course_id")
    .eq("organization_id", membership.businessId);

  const lecturersByCourse = new Map<string, Array<{ clerk_user_id: string; display_name: string; role: string }>>();
  for (const l of lecturers || []) {
    const list = lecturersByCourse.get(l.course_id) || [];
    list.push({ clerk_user_id: l.clerk_user_id, display_name: l.display_name, role: "PRIMARY" });
    lecturersByCourse.set(l.course_id, list);
  }

  const enrollCountByCourse = new Map<string, number>();
  for (const e of enrollments || []) {
    enrollCountByCourse.set(e.course_id, (enrollCountByCourse.get(e.course_id) || 0) + 1);
  }

  return (courses as any[]).map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    department_id: c.department_id,
    department_name: c.departments?.name || "Department",
    faculty_name: c.departments?.faculties?.name || "Faculty",
    status: "ACTIVE",
    enrolled_count: enrollCountByCourse.get(c.id) || 0,
    lecturers: lecturersByCourse.get(c.id) || [],
  }));
}
