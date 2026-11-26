import "server-only";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import type { SchoolSnapshot } from "./contracts";

export type EnrichedStudentRecord = {
  id: string;
  full_name: string;
  matric_number: string;
  department_id: string;
  department_name: string;
  faculty_id: string;
  faculty_name: string;
  programme: string;
  level: string;
  phone: string;
  email: string;
  created_at: string | null;
  has_photo: boolean;
  latest_status: SchoolSnapshot["attendance"][number]["status"] | null;
  enrolled_courses: string[];
};

export async function getEnrichedStudents(snapshot: SchoolSnapshot): Promise<EnrichedStudentRecord[]> {
  const membership = await requireBusinessMembership();
  const orgId = membership.businessId;

  const facultyById = new Map(snapshot.faculties.map((f) => [f.id, f]));
  const departmentById = new Map(snapshot.departments.map((d) => [d.id, d]));
  const courseCodeById = new Map(snapshot.courses.map((c) => [c.id, c.code]));

  const latestByStudent = new Map<string, SchoolSnapshot["attendance"][number]>();
  for (const record of snapshot.attendance.slice().sort((a, b) => (b.check_in_at ?? "").localeCompare(a.check_in_at ?? ""))) {
    if (!latestByStudent.has(record.student_id)) latestByStudent.set(record.student_id, record);
  }

  const coursesByStudent = new Map<string, string[]>();
  for (const enrollment of snapshot.enrollments) {
    const code = courseCodeById.get(enrollment.course_id);
    if (!code) continue;
    const list = coursesByStudent.get(enrollment.student_id) ?? [];
    if (!list.includes(code)) list.push(code);
    coursesByStudent.set(enrollment.student_id, list);
  }

  const profileMeta = new Map<string, { created_at: string | null; phone: string; programme: string; has_photo: boolean }>();
  const personEmail = new Map<string, string>();

  if (snapshot.students.length > 0) {
    try {
      const db = createJoinSupabaseClient();
      const [profilesRes, peopleRes] = await Promise.all([
        db
          .from("school_profiles")
          .select("id, created_at, phone, programme, reference_photo_path")
          .eq("organization_id", orgId),
        db
          .from("people")
          .select("id, email")
          .eq("organization_id", orgId)
          .eq("type", "STUDENT"),
      ]);

      for (const row of ((profilesRes.data ?? []) as unknown as Array<{
        id: string;
        created_at?: string | null;
        phone?: string | null;
        programme?: string | null;
        reference_photo_path?: string | null;
      }>)) {
        profileMeta.set(row.id, {
          created_at: row.created_at ?? null,
          phone: row.phone ?? "",
          programme: row.programme ?? "",
          has_photo: Boolean(row.reference_photo_path),
        });
      }

      for (const row of (peopleRes.data ?? []) as Array<{ id: string; email?: string | null }>) {
        if (row.email) personEmail.set(row.id, row.email);
      }
    } catch {
      // Keep snapshot data even if extended metadata query is temporarily unavailable.
    }
  }

  return snapshot.students.map((student) => {
    const dept = departmentById.get(student.department_id);
    const faculty = dept ? facultyById.get(dept.faculty_id) : undefined;
    const meta = profileMeta.get(student.id);
    const latest = latestByStudent.get(student.id);

    return {
      id: student.id,
      full_name: student.full_name,
      matric_number: student.matric_number,
      department_id: student.department_id,
      department_name: dept?.name ?? "Unassigned",
      faculty_id: faculty?.id ?? "",
      faculty_name: faculty?.name ?? "Unassigned",
      programme: meta?.programme || student.programme || "",
      level: student.level,
      phone: meta?.phone ?? "",
      email: personEmail.get(student.id) ?? "",
      created_at: meta?.created_at ?? null,
      has_photo: meta?.has_photo ?? false,
      latest_status: latest?.status ?? null,
      enrolled_courses: coursesByStudent.get(student.id) ?? [],
    };
  });
}
