import Link from "next/link";
import { SetupForms } from "@/components/school/forms";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EmptyState, PageHeading } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getSchoolSnapshot } from "@/lib/school/data";
import "@/components/school/school.css";

export default async function CoursesPage() {
  const [membership, { snapshot: data, canManage }] = await Promise.all([requireBusinessMembership(), getSchoolSnapshot()]);
  const individual = membership.workspaceOwnership === "INDIVIDUAL";
  return <>
    <PageHeading eyebrow="COURSES" title="Your teaching, organized." description={individual ? "Create course structure, add your student roster and manage class attendance." : "Create your school structure, enroll students and manage class attendance."} />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    {data.courses.length ? <div className="school-grid">{data.courses.map((course) => <Link key={course.id} className="school-card" href={`/dashboard/courses/${course.id}`}><h2>{course.code}</h2><p>{course.title}</p><p>{data.enrollments.filter((item) => item.course_id === course.id).length} students</p><p>{data.lecturers.filter((item) => item.course_id === course.id).map((item) => item.display_name).join(", ") || "No lecturer assigned"}</p></Link>)}</div> : <EmptyState title="No courses yet" description={canManage ? (individual ? "Add your teaching structure, then create your first course below." : "Add a faculty and department, then create your first course below.") : "Create a course in an existing department or ask an administrator to assign one to your account."} illustration={TURNMARK_ASSETS.characters.student} />}
    <SetupForms snapshot={data} canManage={canManage} />
  </>;
}
