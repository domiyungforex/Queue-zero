import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EmptyState, PageHeading } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { schoolTime } from "@/lib/school/contracts";
import { getSchoolSnapshot } from "@/lib/school/data";
import "@/components/school/school.css";

export default async function AttendancePage() {
  const { snapshot: data } = await getSchoolSnapshot();
  return <>
    <PageHeading eyebrow="ATTENDANCE" title="Attendance without account friction." description="Open a class, display its stable QR and watch roster-verified arrivals update live." action={<Link className="button-primary" href="/dashboard/courses">Manage courses</Link>} />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    {data.classes.length ? <div className="school-grid">{data.classes.slice().sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? "")).map((session) => <Link className="school-card" key={session.id} href={`/dashboard/attendance/${session.id}`}><h2>{data.courses.find((course) => course.id === session.course_id)?.code}</h2><p>{schoolTime(session.starts_at)}</p><p>{session.status} · {data.attendance.filter((record) => record.class_session_id === session.id && record.check_in_at).length} arrivals</p></Link>)}</div> : <EmptyState title="No attendance sessions" description="Choose a course and create your first class." href="/dashboard/courses" label="Open courses" illustration={TURNMARK_ASSETS.characters.student} />}
  </>;
}
