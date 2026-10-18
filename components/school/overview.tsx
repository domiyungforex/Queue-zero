import { currentUser } from "@clerk/nextjs/server";
import { BookOpen, CalendarDays, GraduationCap, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { DashboardEmptyState, DashboardKpiCard, DashboardSection, DashboardStatusBadge, WorkspaceCharacter } from "@/components/dashboard/dashboard-primitives";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EmptyState, PageHeading, StatCard } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { attendanceIsLate, schoolTime, type SchoolSnapshot } from "@/lib/school/contracts";
import { buildEducationDashboard } from "@/lib/school/dashboard";
import { getSchoolSnapshot } from "@/lib/school/data";
import styles from "./education-dashboard.module.css";
import "./school.css";

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function compactDate(value: string) { return value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—"; }
async function displayName() {
  try {
    const identity = await currentUser();
    return identity?.firstName ?? identity?.fullName?.split(/\s+/)[0] ?? null;
  } catch { return null; }
}

function ClassRows({ data, classes }: { data: SchoolSnapshot; classes: ReturnType<typeof buildEducationDashboard>["classes"] }) {
  if (!classes.length) return <DashboardEmptyState title="No classes today" description="Scheduled classes will appear here when they are available." href="/dashboard/classes" label="View classes" />;
  return <ul className={styles.classList}>{classes.slice(0, 4).map((session) => {
    const course = data.courses.find((item) => item.id === session.course_id);
    return <li className={styles.classRow} key={session.id}><span className={styles.rowIcon}><BookOpen size={14} aria-hidden="true" /></span><Link className={styles.rowMain} href={`/dashboard/attendance/${session.id}`}><strong>{course?.code ?? "Class"}</strong><span>{course?.title ?? "Course details"}</span></Link><div><span className={styles.rowTime}>{schoolTime(session.starts_at)}</span><DashboardStatusBadge status={session.status === "OPEN" ? "Live" : session.status} /></div></li>;
  })}</ul>;
}

export async function SchoolOverview({ individual = false }: { individual?: boolean }) {
  const [{ snapshot: data }, name] = await Promise.all([getSchoolSnapshot(), displayName()]);
  const dashboard = buildEducationDashboard(data, new Date().toISOString().slice(0, 10));
  return <div className={styles.dashboard}>
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <div className={styles.topGrid}>
      <section className={styles.hero} aria-labelledby="education-welcome"><div className={styles.heroCopy}><p>{individual ? "YOUR TEACHING WORKSPACE" : "EDUCATION WORKSPACE"}</p><h1 id="education-welcome">Welcome back{name ? <span>{name}</span> : null}</h1><p>{individual ? "Manage your classes and attendance independently." : "Manage your classes, track attendance and keep your students informed."}</p></div><WorkspaceCharacter asset={TURNMARK_ASSETS.auth.welcomeStudent} className={styles.heroCharacter} priority /></section>
      <DashboardSection title="Today’s classes" href="/dashboard/classes" className={styles.todayPanel}><ClassRows data={data} classes={dashboard.classes} /></DashboardSection>
    </div>
    <div className={styles.kpis}>
      <DashboardKpiCard icon={GraduationCap} value={dashboard.metrics.totalStudents} label="Total Students" color="#16966a" soft="#e5f8ef" />
      <DashboardKpiCard icon={UserCheck} value={dashboard.metrics.presentToday} label="Present Today" color="#4f67ee" soft="#e9edff" />
      <DashboardKpiCard icon={UserX} value={dashboard.metrics.absentToday} label="Absent" color="#ff6b2b" soft="#fff0e8" />
      <DashboardKpiCard icon={CalendarDays} value={dashboard.metrics.classesToday} label="Classes Today" color="#7c3aed" soft="#f1eaff" />
    </div>
    <div className={styles.mobileOnly}><DashboardSection title="Today’s classes" href="/dashboard/classes"><ClassRows data={data} classes={dashboard.classes} /></DashboardSection></div>
    <div className={styles.lowerGrid}>
      <DashboardSection title="Recent attendance" href="/dashboard/attendance" linkLabel="See all">{dashboard.recentAttendance.length ? <ul className={styles.attendanceList}>{dashboard.recentAttendance.map((record) => <li className={styles.attendanceRow} key={record.id}><span className={styles.initials}>{initials(record.student?.full_name ?? "Student")}</span><span className={styles.rowMain}><strong>{record.student?.full_name ?? "Student"}</strong><span>{record.student?.matric_number ?? "Roster record"}</span></span><DashboardStatusBadge status={record.status} /><span className={styles.attendanceTime}>{schoolTime(record.check_in_at)}</span></li>)}</ul> : <DashboardEmptyState title="No attendance records yet" description="Today’s verified attendance will appear here." />}</DashboardSection>
      <DashboardSection title="Attendance trend" className={styles.desktopTrend}>{dashboard.attendanceTrend.some((item) => item.rate !== null) ? <div className={styles.trend} role="img" aria-label="Attendance percentage for the seven most recent completed classes">{dashboard.attendanceTrend.map((item) => <div className={styles.trendItem} key={item.id}><em>{item.rate === null ? "—" : `${item.rate}%`}</em><span className={styles.trendBar} style={{ height: `${Math.max(item.rate ?? 0, 3)}%` }} /><small>{compactDate(item.date)}</small></div>)}</div> : <DashboardEmptyState title="Not enough activity yet" description="Complete classes to see an attendance trend based on real records." />}</DashboardSection>
    </div>
  </div>;
}

export async function SchoolAnalytics() {
  const { snapshot: data } = await getSchoolSnapshot();
  const completed = data.classes.filter((item) => item.status === "COMPLETED");
  const ids = new Set(completed.map((item) => item.id));
  const rows = data.attendance.filter((item) => ids.has(item.class_session_id));
  const present = rows.filter((item) => item.check_in_at).length;
  const rate = (count: number) => rows.length ? `${Math.round(count / rows.length * 100)}%` : "—";
  return <section>
    <PageHeading eyebrow="SCHOOL ANALYTICS" title="Attendance over time." description="Finalized class records. Unfinished classes are excluded from attendance rates." />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <div className="school-grid"><StatCard label="Attendance rate" value={rate(present)} /><StatCard label="Late rate" value={rate(rows.filter((row) => attendanceIsLate(row, data.classes)).length)} /><StatCard label="Absence rate" value={rate(rows.filter((row) => row.status === "ABSENT").length)} /><StatCard label="Early departures" value={rows.filter((row) => row.status === "EARLY_LEAVE").length} /><StatCard label="Flagged scans" value={data.flags.filter((flag) => ids.has(flag.class_session_id)).length} /></div>
    {!rows.length ? <EmptyState title="No finalized attendance yet" description="Finish your first class to see attendance rates based on actual records." illustration={TURNMARK_ASSETS.icons.reports} /> : <div className="school-table-wrap"><table className="school-table"><caption>Attendance by course · completed classes only</caption><thead><tr><th>Course</th><th>Classes</th><th>Attended</th><th>Expected</th><th>Attendance</th></tr></thead><tbody>{data.courses.map((course) => { const courseClasses = completed.filter((item) => item.course_id === course.id); const courseIds = new Set(courseClasses.map((item) => item.id)); const records = rows.filter((row) => courseIds.has(row.class_session_id)); const attended = records.filter((row) => row.check_in_at).length; return <tr key={course.id}><th>{course.code}</th><td>{courseClasses.length}</td><td>{attended}</td><td>{records.length}</td><td>{records.length ? `${Math.round(attended / records.length * 100)}%` : "—"}</td></tr>; })}</tbody></table></div>}
    <div className="school-table-wrap"><table className="school-table"><caption>Recent class attendance trend (UTC)</caption><thead><tr><th>Date</th><th>Course</th><th>Attended</th><th>Absent</th></tr></thead><tbody>{completed.slice().sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? "")).slice(0, 30).map((session) => { const records = rows.filter((row) => row.class_session_id === session.id); return <tr key={session.id}><td>{schoolTime(session.starts_at)}</td><td>{data.courses.find((course) => course.id === session.course_id)?.code}</td><td>{records.filter((row) => row.check_in_at).length}</td><td>{records.filter((row) => row.status === "ABSENT").length}</td></tr>; })}</tbody></table></div>
  </section>;
}
