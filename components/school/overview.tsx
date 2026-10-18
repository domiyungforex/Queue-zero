import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  Plus,
  QrCode,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { DashboardEmptyState, DashboardKpiCard, DashboardStatusBadge, WorkspaceCharacter } from "@/components/dashboard/dashboard-primitives";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EmptyState, PageHeading, StatCard } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { attendanceIsLate, schoolTime, type SchoolSnapshot } from "@/lib/school/contracts";
import { buildEducationDashboard } from "@/lib/school/dashboard";
import { getSchoolSnapshot } from "@/lib/school/data";
import styles from "./education-dashboard.module.css";
import "./school.css";

type EducationDashboard = ReturnType<typeof buildEducationDashboard>;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function compactDate(value: string) {
  return value
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
    : "—";
}

function classTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(value))
    : "Time not set";
}

function classTimeRange(startsAt: string | null, endsAt: string | null) {
  const start = classTime(startsAt);
  if (!endsAt) return start;
  return `${start} – ${classTime(endsAt)}`;
}

function sessionStatus(status: string) {
  if (status === "OPEN") return "Live";
  if (status === "COMPLETED") return "Completed";
  return "Upcoming";
}

function ClassRows({ data, classes }: { data: SchoolSnapshot; classes: EducationDashboard["classes"] }) {
  if (!classes.length) {
    return <DashboardEmptyState title="No classes today" description="Scheduled classes will appear here when they are available." href="/dashboard/courses" label="Create a class" />;
  }

  return <ul className={styles.classList}>{classes.slice(0, 4).map((session, index) => {
    const course = data.courses.find((item) => item.id === session.course_id);
    return <li className={styles.classRow} key={session.id}>
      <span className={`${styles.rowIcon} ${styles[`rowIcon${index % 3}`]}`}><BookOpen size={18} aria-hidden="true" /></span>
      <Link className={styles.rowMain} href={`/dashboard/attendance/${session.id}`} aria-label={`Open ${course?.code ?? "class"} attendance`}>
        <strong>{course?.code ?? "Class"}</strong>
        <span>{course?.title ?? "Course details"}</span>
      </Link>
      <span className={styles.rowTime}><Clock3 size={14} aria-hidden="true" />{classTimeRange(session.starts_at, session.ends_at)}</span>
      <DashboardStatusBadge status={sessionStatus(session.status)} />
      <ChevronRight className={styles.rowChevron} size={17} aria-hidden="true" />
    </li>;
  })}</ul>;
}

const quickActions = [
  { href: "/dashboard/courses", label: "Create Class", description: "Set up a class", icon: Plus, tone: "orange" },
  { href: "/dashboard/students", label: "Add Students", description: "Import a roster", icon: UserPlus, tone: "purple" },
  { href: "/dashboard/attendance", label: "Take Attendance", description: "Open class tools", icon: QrCode, tone: "blue" },
  { href: "/dashboard/exports", label: "View Reports", description: "Attendance insights", icon: BarChart3, tone: "green" },
] as const;

function QuickActions() {
  return <section className={styles.panel} aria-labelledby="quick-actions-title">
    <header className={styles.panelHeader}><h2 id="quick-actions-title">Quick Actions</h2></header>
    <div className={styles.quickGrid}>{quickActions.map(({ href, label, description, icon: Icon, tone }) => <Link className={styles.quickAction} data-tone={tone} href={href} key={href}>
      <span className={styles.quickIcon}><Icon size={19} aria-hidden="true" /></span>
      <strong>{label}</strong>
      <span>{description}</span>
      <ChevronRight size={15} aria-hidden="true" />
    </Link>)}</div>
  </section>;
}

function RecentAttendance({ data, records }: { data: SchoolSnapshot; records: EducationDashboard["recentAttendance"] }) {
  return <section className={styles.panel} aria-labelledby="recent-attendance-title">
    <header className={styles.panelHeader}><h2 id="recent-attendance-title">Recent Attendance</h2><Link href="/dashboard/attendance">View all<ChevronRight size={15} aria-hidden="true" /></Link></header>
    {records.length ? <ul className={styles.attendanceList}>{records.map((record) => {
      const session = data.classes.find((item) => item.id === record.class_session_id);
      const course = data.courses.find((item) => item.id === session?.course_id);
      return <li className={styles.attendanceRow} key={record.id}>
        <span className={styles.initials}>{initials(record.student?.full_name ?? "Student")}</span>
        <span className={styles.rowMain}><strong>{record.student?.full_name ?? "Student"}</strong><span>{course?.code ?? "Class attendance"}</span></span>
        <DashboardStatusBadge status={record.status} />
        <span className={styles.attendanceTime}>{classTime(record.check_in_at)}</span>
        <ChevronRight className={styles.rowChevron} size={17} aria-hidden="true" />
      </li>;
    })}</ul> : <DashboardEmptyState title="No attendance records yet" description="Today’s verified attendance will appear here." />}
  </section>;
}

export function EducationHome({ data, dashboard, individual = false }: { data: SchoolSnapshot; dashboard: EducationDashboard; individual?: boolean }) {
  return <div className={styles.dashboard}>
    <section className={styles.hero} aria-labelledby="education-welcome">
      <div className={styles.heroShapeOne} aria-hidden="true" />
      <div className={styles.heroShapeTwo} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>WELCOME BACK</p>
        <h1 id="education-welcome"><span className={styles.heroLead}>Your teaching,</span><span className={styles.heroAccent}>organized.</span></h1>
        <p className={styles.heroDescription}>{individual ? "Create classes, take attendance and keep your students informed — all in one focused workspace." : "Create classes, take attendance and keep your students informed — all in one place."}</p>
        <Link className={styles.heroAction} href="/dashboard/courses"><Plus size={20} aria-hidden="true" />Create class</Link>
      </div>
      <WorkspaceCharacter asset={TURNMARK_ASSETS.characters.student} className={styles.heroCharacter} priority />
    </section>

    <section className={styles.kpis} aria-label="Education workspace summary">
      <DashboardKpiCard icon={GraduationCap} value={dashboard.metrics.totalStudents} label="Total Students" color="#ff6b2b" soft="#fff0e8" />
      <DashboardKpiCard icon={UserCheck} value={dashboard.metrics.presentToday} label="Present Today" color="#18a66c" soft="#e6f8ef" />
      <DashboardKpiCard icon={UserX} value={dashboard.metrics.absentToday} label="Absent Today" color="#ff4765" soft="#ffeaf0" />
      <DashboardKpiCard icon={CalendarDays} value={dashboard.metrics.classesToday} label="Classes Today" color="#7c3aed" soft="#f1eaff" />
    </section>

    <QuickActions />

    <section className={styles.panel} aria-labelledby="todays-classes-title">
      <header className={styles.panelHeader}><h2 id="todays-classes-title">Today’s Classes</h2><Link href="/dashboard/classes">View all<ChevronRight size={15} aria-hidden="true" /></Link></header>
      <ClassRows data={data} classes={dashboard.classes} />
    </section>

    <div className={styles.lowerGrid}>
      <RecentAttendance data={data} records={dashboard.recentAttendance} />
      <section className={`${styles.panel} ${styles.desktopTrend}`} aria-labelledby="attendance-trend-title">
        <header className={styles.panelHeader}><h2 id="attendance-trend-title">Attendance Trend</h2><Link href="/dashboard/analytics">View reports<ChevronRight size={15} aria-hidden="true" /></Link></header>
        {dashboard.attendanceTrend.some((item) => item.rate !== null) ? <div className={styles.trend} role="img" aria-label="Attendance percentage for the seven most recent completed classes">{dashboard.attendanceTrend.map((item) => <div className={styles.trendItem} key={item.id}><em>{item.rate === null ? "—" : `${item.rate}%`}</em><span className={styles.trendBar} style={{ height: `${Math.max(item.rate ?? 0, 3)}%` }} /><small>{compactDate(item.date)}</small></div>)}</div> : <DashboardEmptyState title="Not enough activity yet" description="Complete classes to see an attendance trend based on real records." />}
      </section>
    </div>
  </div>;
}

export async function SchoolOverview({ individual = false }: { individual?: boolean }) {
  const { snapshot: data } = await getSchoolSnapshot();
  const dashboard = buildEducationDashboard(data, new Date().toISOString().slice(0, 10));
  return <>
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <EducationHome data={data} dashboard={dashboard} individual={individual} />
  </>;
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
