import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EmptyState, PageHeading, StatusPill } from "@/components/ui/workspace";
import { schoolTime } from "@/lib/school/contracts";
import { getSchoolSnapshot } from "@/lib/school/data";
import "@/components/school/school.css";

export default async function ClassesPage() {
  const { snapshot } = await getSchoolSnapshot();
  const classes = snapshot.classes.slice().sort((first, second) => (second.starts_at ?? "").localeCompare(first.starts_at ?? ""));
  const courseById = new Map(snapshot.courses.map((course) => [course.id, course]));
  const arrivalsByClass = new Map<string, number>();
  for (const record of snapshot.attendance) {
    if (record.check_in_at) arrivalsByClass.set(record.class_session_id, (arrivalsByClass.get(record.class_session_id) ?? 0) + 1);
  }

  return <>
    <PageHeading eyebrow="CLASSES" title="Every class session, in one place." description="Start a class from its course, then manage the attendance window and live register here." action={<Link className="button-primary" href="/dashboard/courses">Manage courses</Link>} />
    <LiveRefresh topic={`school:${snapshot.organization.id}`} authenticated />
    {classes.length ? <div className="school-grid">
      {classes.map((session) => {
        const course = courseById.get(session.course_id);
        const arrivals = arrivalsByClass.get(session.id) ?? 0;
        return <Link className="school-card" key={session.id} href={`/dashboard/attendance/${session.id}`}>
          <div className="flex items-start justify-between gap-3"><h2>{course?.code ?? "Class"}</h2><StatusPill status={session.status.toLowerCase()} /></div>
          <p>{course?.title ?? "Course session"}</p>
          <p>{schoolTime(session.starts_at)} · {arrivals} {arrivals === 1 ? "arrival" : "arrivals"}</p>
        </Link>;
      })}
    </div> : <EmptyState title="No classes yet" description="Create a course, add its roster and start your first class session." href="/dashboard/courses" label="Open courses" />}
  </>;
}
