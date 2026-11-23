import { BookOpen, CalendarClock, ChevronRight, Plus, Search, UserCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EducationEmpty, EducationHeading, EducationStatus, formatTime } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { getSchoolSnapshot } from "@/lib/school/data";

type ClassFilter = "all" | "upcoming" | "ongoing" | "past";

function sessionGroup(status: string): ClassFilter {
  if (status === "OPEN") return "ongoing";
  if (status === "COMPLETED") return "past";
  return "upcoming";
}

function statusView(status?: string) {
  if (status === "OPEN") return { label: "Live", tone: "success" as const };
  if (status === "COMPLETED") return { label: "Completed", tone: "muted" as const };
  return { label: status ? "Upcoming" : "No session", tone: "info" as const };
}

export default async function ClassesPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ q?: string; filter?: string }> } = {}) {
  const [{ snapshot }, query] = await Promise.all([getSchoolSnapshot(), searchParams]);
  const search = query.q?.trim().toLocaleLowerCase() ?? "";
  const filter: ClassFilter = ["upcoming", "ongoing", "past"].includes(query.filter ?? "") ? query.filter as ClassFilter : "all";
  const sessionsByCourse = new Map(snapshot.courses.map((course) => [course.id, snapshot.classes.filter((session) => session.course_id === course.id).sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""))]));
  const courses = snapshot.courses.filter((course) => {
    const sessions = sessionsByCourse.get(course.id) ?? [];
    const latest = sessions.find((session) => session.status === "OPEN") ?? sessions[0];
    return (!search || `${course.code} ${course.title}`.toLocaleLowerCase().includes(search)) && (filter === "all" || (latest && sessionGroup(latest.status) === filter));
  });
  const tabs: { value: ClassFilter; label: string }[] = [{ value: "all", label: "All Classes" }, { value: "ongoing", label: "Ongoing" }, { value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }];

  return <main className={styles.page}>
    <EducationHeading eyebrow="CLASSES" title="Classes" description="Manage your classes, schedules and class details." action={<Link className={styles.primary} href="/dashboard/courses?create=1#course-setup"><Plus size={18} aria-hidden="true" />Create class</Link>} />
    <LiveRefresh topic={`school:${snapshot.organization.id}`} authenticated />
    <form className={styles.toolbar} role="search">
      <label className={styles.search}><Search size={17} aria-hidden="true" /><span className="sr-only">Search classes</span><input name="q" type="search" defaultValue={query.q} placeholder="Search classes…" /><input type="hidden" name="filter" value={filter} /></label>
      <button className={styles.secondary} type="submit">Search</button>
    </form>
    <nav className={styles.filters} aria-label="Filter classes">
      {tabs.map((tab) => <Link className={styles.tab} data-active={filter === tab.value} key={tab.value} href={{ pathname: "/dashboard/classes", query: { ...(query.q ? { q: query.q } : {}), ...(tab.value === "all" ? {} : { filter: tab.value }) } }}>{tab.label}</Link>)}
    </nav>
    {courses.length ? <section className={styles.grid} aria-label="Classes">
      {courses.map((course) => {
        const sessions = sessionsByCourse.get(course.id) ?? [];
        const session = sessions.find((item) => item.status === "OPEN") ?? sessions[0];
        const roster = (snapshot.enrollments ?? []).filter((item) => item.course_id === course.id).length;
        const arrivals = session ? snapshot.attendance.filter((item) => item.class_session_id === session.id && item.check_in_at).length : 0;
        const courseLecturers = snapshot.lecturers.filter((item) => item.course_id === course.id);
        const status = statusView(session?.status);
        return <Link className={styles.card} href={session?.status === "OPEN" ? `/dashboard/attendance/${session.id}` : `/dashboard/courses/${course.id}`} key={course.id}>
          <span className={styles.icon}><BookOpen size={21} aria-hidden="true" /></span>
          <span className={styles.cardCopy}>
            <strong>{course.code}</strong>
            <span>{course.title}</span>
            <span className={styles.meta}>
              <UsersRound size={13} aria-hidden="true" />
              {session?.status === "OPEN" ? `${arrivals} ${arrivals === 1 ? "arrival" : "arrivals"}` : `${roster} ${roster === 1 ? "student" : "students"}`}
              <CalendarClock size={13} aria-hidden="true" />
              {formatTime(session?.starts_at ?? null)}
              {courseLecturers.length > 0 && (
                <>
                  <span style={{ margin: "0 2px", color: "#d5e0d8" }}>•</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <UserCheck size={13} aria-hidden="true" />
                    <span>{courseLecturers.map((l) => l.display_name).join(", ")}</span>
                  </span>
                </>
              )}
            </span>
          </span>
          <span><EducationStatus tone={status.tone}>{status.label}</EducationStatus><ChevronRight className={styles.chevron} size={18} aria-hidden="true" /></span>
        </Link>;
      })}
    </section> : <EducationEmpty title={search || filter !== "all" ? "No matching classes" : "No classes yet"} description={search || filter !== "all" ? "Try another search or class status." : "Create your course structure, add students and schedule the first class."} href="/dashboard/courses?create=1#course-setup" label="Create class" icon={BookOpen} />}
  </main>;
}
