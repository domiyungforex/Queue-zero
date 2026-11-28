import Link from "next/link";
import { getSchoolSnapshot } from "@/lib/school/data";
import { schoolTime, attendanceIsLate } from "@/lib/school/contracts";
import { CreateClassForm, EnrollmentForm, SchoolForm, TextField } from "@/components/school/forms";
import { CourseAudienceForm } from "@/components/school/course-audience-form";
import { CourseDeleteBar } from "@/components/school/course-delete-bar";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EmptyState, PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";
import "@/components/school/school.css";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { snapshot: data, canManage } = await getSchoolSnapshot(courseId);
  const course = data.courses.find((item) => item.id === courseId)!;
  const sessions = data.classes
    .filter((item) => item.course_id === courseId)
    .sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  const lecturers = data.lecturers.filter((item) => item.course_id === courseId);
  const enrollmentCount = data.enrollments.filter((item) => item.course_id === courseId).length;

  return <>
    <Breadcrumbs items={[{ label: "Courses", href: "/dashboard/courses" }, { label: course.code }]} />
    <PageHeading eyebrow={course.code} title={course.title} description={`${enrollmentCount} enrolled students`} action={<Link href="/dashboard/courses" className="button-secondary">All courses</Link>} />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <h2 className="school-subheading">Class sessions</h2>
    {sessions.length ? <div className="school-table-wrap"><table className="school-table">
      <thead><tr><th>Class start</th><th>Status</th><th data-numeric="true">Attended</th><th data-numeric="true">Absent</th><th data-numeric="true">Late</th></tr></thead>
      <tbody>{sessions.map((session) => {
        const records = data.attendance.filter((item) => item.class_session_id === session.id);
        return <tr key={session.id}>
          <td><Link href={`/dashboard/attendance/${session.id}`}>{schoolTime(session.starts_at)}</Link></td>
          <td>{session.status}</td>
          <td data-numeric="true">{records.filter((item) => item.check_in_at).length}</td>
          <td data-numeric="true">{records.filter((item) => item.status === "ABSENT").length}</td>
          <td data-numeric="true">{records.filter((item) => attendanceIsLate(item, data.classes)).length}</td>
        </tr>;
      })}</tbody>
    </table></div> : <EmptyState title="No classes yet" description="Create a class and open attendance to display its stable QR." />}
    <div className="school-grid"><CreateClassForm courseId={courseId} /><EnrollmentForm snapshot={data} courseId={courseId} /></div>
    <CourseAudienceForm courseId={courseId} departments={data.departments.map((department) => ({ id: department.id, name: department.name }))} />
    {canManage ? <details className="school-optional" open>
      <summary>Lecturer assignments <span>Academic Staff</span></summary>
      <div className="school-optional-content">
        <p>Assigning a lecturer delegates access to this course. Assigned lecturers can launch class sessions, take verified student attendance, and manage rosters on behalf of the institution.</p>
        {lecturers.length ? (
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 750 }}>Currently Assigned:</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              {lecturers.map((lecturer) => <SchoolForm key={lecturer.clerk_user_id} action="remove_lecturer" title={lecturer.display_name} fields={{ course_id: courseId, user_id: lecturer.clerk_user_id }} submit="Remove access">
                <p style={{ margin: 0, fontSize: "12px", color: "#73788a" }}>Authorized lecturer for {course.code}.</p>
              </SchoolForm>)}
            </div>
          </div>
        ) : (
          <div style={{ padding: "12px 16px", background: "#fffaf7", border: "1px dashed #ffd9ca", borderRadius: "10px", marginBottom: "16px", color: "#d94b14", fontSize: "13px" }}>
            No lecturer assigned yet. Assign a lecturer below so they can take attendance and conduct sessions for this course.
          </div>
        )}
        <SchoolForm action="lecturer" title="Assign a lecturer" fields={{ course_id: courseId }} submit="Assign lecturer">
          <TextField name="email" label="Verified lecturer email" type="email" maxLength={254} />
          <p className="text-sm text-muted">The lecturer must already have a TuRnMaRk staff account with this email verified.</p>
        </SchoolForm>
      </div>
    </details> : null}
    <CourseDeleteBar courseId={courseId} courseCode={course.code} />
  </>;
}
