import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Plus,
  QrCode,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
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

function ClassRows({ data, classes, individual = false }: { data: SchoolSnapshot; classes: EducationDashboard["classes"]; individual?: boolean }) {
  if (!classes.length) {
    return <DashboardEmptyState title="No classes today" description={individual ? "Scheduled classes will appear here when they are available." : "No classes currently scheduled across departments."} href="/dashboard/courses" label={individual ? "Create a class" : "Manage courses"} />;
  }

  return <ul className={styles.classList}>{classes.slice(0, 4).map((session, index) => {
    const course = data.courses.find((item) => item.id === session.course_id);
    const sessionLecturers = data.lecturers.filter((item) => item.course_id === session.course_id);
    const lecturerName = sessionLecturers[0]?.display_name;
    return <li className={styles.classRow} key={session.id}>
      <span className={`${styles.rowIcon} ${styles[`rowIcon${index % 3}`]}`}><BookOpen size={18} aria-hidden="true" /></span>
      <Link className={styles.rowMain} href={`/dashboard/attendance/${session.id}`} aria-label={`Open ${course?.code ?? "class"} attendance`}>
        <strong>{course?.code ?? "Class"}</strong>
        <span>{course?.title ?? "Course details"}{!individual && lecturerName ? ` · Lecturer: ${lecturerName}` : ""}</span>
      </Link>
      <span className={styles.rowTime}><Clock3 size={14} aria-hidden="true" />{classTimeRange(session.starts_at, session.ends_at)}</span>
      <DashboardStatusBadge status={sessionStatus(session.status)} />
      <ChevronRight className={styles.rowChevron} size={17} aria-hidden="true" />
    </li>;
  })}</ul>;
}

function QuickActions({ individual = false }: { individual?: boolean }) {
  const actions = individual
    ? [
        { href: "/dashboard/courses", label: "Create Class", description: "Set up a class", icon: Plus, tone: "orange" as const },
        { href: "/dashboard/attendance", label: "Take Attendance", description: "Open class tools", icon: QrCode, tone: "blue" as const },
        { href: "/dashboard/students", label: "My Students", description: "Manage roster", icon: UserPlus, tone: "purple" as const },
        { href: "/dashboard/exports", label: "Class Reports", description: "Attendance records", icon: BarChart3, tone: "green" as const },
      ]
    : [
        { href: "/dashboard/courses", label: "Assign Lecturers", description: "Delegate course leads", icon: UserCheck, tone: "purple" as const },
        { href: "/dashboard/students", label: "Student Onboarding", description: "Registration links", icon: UserPlus, tone: "orange" as const },
        { href: "/dashboard/attendance", label: "Monitor Sessions", description: "Audit live lectures", icon: ClipboardCheck, tone: "blue" as const },
        { href: "/dashboard/exports", label: "Institution Reports", description: "Accreditation analytics", icon: BarChart3, tone: "green" as const },
      ];

  return <section className={styles.panel} aria-labelledby="quick-actions-title">
    <header className={styles.panelHeader}><h2 id="quick-actions-title">Quick Actions</h2></header>
    <div className={styles.quickGrid}>{actions.map(({ href, label, description, icon: Icon, tone }) => <Link className={styles.quickAction} data-tone={tone} href={href} key={href}>
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

export function EducationHome({ data, dashboard, individual = false, userName = "Lecturer" }: { data: SchoolSnapshot; dashboard: EducationDashboard; individual?: boolean; userName?: string }) {
  const activeClass = dashboard.classes.find((session) => session.status === "OPEN");
  return <div className={styles.dashboard}>
    <section className={styles.hero} aria-labelledby="education-welcome">
      <div className={styles.heroShapeOne} aria-hidden="true" />
      <div className={styles.heroShapeTwo} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{individual ? "PERSONAL TEACHING WORKSPACE" : "ORGANIZATION EDUCATION PORTAL"}</p>
        <h1 id="education-welcome">
          <span className={styles.heroLead}>{individual ? "Good day," : "Welcome to "}</span>
          <span className={styles.heroAccent}>{individual ? userName : data.organization.name}</span>
        </h1>
        <p className={styles.heroDescription}>
          {individual
            ? "Your focused personal workspace: manage your classes, track attendance, and guide your students."
            : "Institutional education management: assign academic staff to courses, monitor live classroom attendance, and oversee verified student records."}
        </p>
        {individual ? (
          activeClass ? (
            <Link className={styles.heroAction} href={`/dashboard/attendance/${activeClass.id}`}>
              <ClipboardCheck size={20} aria-hidden="true" />Take attendance
            </Link>
          ) : (
            <Link className={styles.heroAction} href="/dashboard/courses">
              <Plus size={20} aria-hidden="true" />Create class
            </Link>
          )
        ) : (
          activeClass ? (
            <Link className={styles.heroAction} href={`/dashboard/attendance/${activeClass.id}`}>
              <ClipboardCheck size={20} aria-hidden="true" />Monitor Live Session
            </Link>
          ) : (
            <Link className={styles.heroAction} href="/dashboard/courses">
              <BookOpen size={20} aria-hidden="true" />Manage Courses & Lecturers
            </Link>
          )
        )}
      </div>
      <WorkspaceCharacter asset={TURNMARK_ASSETS.characters.student} className={styles.heroCharacter} priority />
    </section>

    {!individual && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          border: "1px solid #e3ebe4",
          borderRadius: "16px",
          padding: "14px 20px",
          boxShadow: "0 4px 16px rgba(72,39,23,.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#111318", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Institution Overview
          </span>
          <span style={{ fontSize: "11px", color: "#15945f", background: "#e8f8ef", padding: "2px 8px", borderRadius: "999px", fontWeight: 750 }}>
            Active Organization
          </span>
        </div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", color: "#686775" }}>
          <span><strong style={{ color: "#111318" }}>{data.faculties.length}</strong> {data.faculties.length === 1 ? "Faculty" : "Faculties"}</span>
          <span style={{ color: "#d5e0d8" }}>•</span>
          <span><strong style={{ color: "#111318" }}>{data.departments.length}</strong> {data.departments.length === 1 ? "Department" : "Departments"}</span>
          <span style={{ color: "#d5e0d8" }}>•</span>
          <span><strong style={{ color: "#111318" }}>{data.courses.length}</strong> {data.courses.length === 1 ? "Course" : "Courses"}</span>
          <span style={{ color: "#d5e0d8" }}>•</span>
          <span><strong style={{ color: "#111318" }}>{data.lecturers.length}</strong> Assigned {data.lecturers.length === 1 ? "Lecturer" : "Lecturers"}</span>
          <span style={{ color: "#d5e0d8" }}>•</span>
          <span><strong style={{ color: "#111318" }}>{dashboard.metrics.totalStudents}</strong> Enrolled Students</span>
        </div>
      </div>
    )}

    <section className={styles.kpis} aria-label="Education workspace summary">
      <DashboardKpiCard icon={GraduationCap} value={dashboard.metrics.totalStudents} label="Total Students" color="#ff6b2b" soft="#fff0e8" />
      <DashboardKpiCard icon={UserCheck} value={dashboard.metrics.presentToday} label="Present Today" color="#16855b" soft="#e6f8ef" />
      <DashboardKpiCard icon={UserX} value={dashboard.metrics.absentToday} label="Absent Today" color="#c62847" soft="#ffeaf0" />
      <DashboardKpiCard icon={CalendarDays} value={dashboard.metrics.classesToday} label="Classes Today" color="#d94b14" soft="#fff0e8" />
    </section>

    <QuickActions individual={individual} />

    <section className={styles.panel} aria-labelledby="todays-classes-title">
      <header className={styles.panelHeader}><h2 id="todays-classes-title">Today’s Classes</h2><Link href="/dashboard/classes">View all<ChevronRight size={15} aria-hidden="true" /></Link></header>
      <ClassRows data={data} classes={dashboard.classes} individual={individual} />
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
  let data: SchoolSnapshot;
  let dashboard: EducationDashboard;
  let userName = "Lecturer";
  try {
    const loaded = await Promise.all([getSchoolSnapshot(), currentUser().catch(() => null)]);
    data = loaded[0].snapshot;
    const identity = loaded[1];
    dashboard = buildEducationDashboard(data, new Date().toISOString().slice(0, 10));
    userName = identity?.firstName ?? identity?.fullName ?? "Lecturer";
  } catch (error) {
    unstable_rethrow(error);
    console.error("School overview failed", error);
    return <section className={styles.panel} role="alert">
      <header className={styles.panelHeader}><h2>Attendance could not be loaded</h2></header>
      <p style={{ margin: 0, padding: "22px 20px 8px", color: "#5c6570", lineHeight: 1.6 }}>Your workspace is open, but class records could not be read. Nothing here is sample data.</p>
      <p style={{ margin: 0, padding: "0 20px 24px" }}><Link href="/dashboard">Try again</Link></p>
    </section>;
  }
  return <>
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <EducationHome data={data} dashboard={dashboard} individual={individual} userName={userName} />
  </>;
}

export async function SchoolAnalytics() {
  let data: SchoolSnapshot;
  try {
    ({ snapshot: data } = await getSchoolSnapshot());
  } catch (error) {
    unstable_rethrow(error);
    console.error("School analytics failed", error);
    return <PageHeading eyebrow="SCHOOL ANALYTICS" title="Attendance could not be loaded." description="Class records could not be read. Refresh to try again. No sample rates are shown." />;
  }
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
