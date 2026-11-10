import { CalendarCheck, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, LogOut, UserX } from "lucide-react";
import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EducationEmpty, EducationHeading, EducationMetric, EducationStatus, formatTime, initials } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { getSchoolSnapshot } from "@/lib/school/data";

const attended = new Set(["PRESENT", "LATE", "EARLY_LEAVE", "INCOMPLETE", "FLAGGED"]);
const percent = (count: number, total: number) => total ? `${Math.round((count / total) * 100)}%` : "—";
const statusTone = (status: string) => status === "PRESENT" ? "success" as const : status === "ABSENT" ? "danger" as const : status === "LATE" ? "warning" as const : "info" as const;
function reportingCutoff(days: number) { return Date.now() - days * 86_400_000; }

export default async function AttendancePage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ course?: string; period?: string }> } = {}) {
  const [{ snapshot: data }, query] = await Promise.all([getSchoolSnapshot(), searchParams]);
  const days = query.period === "30" ? 30 : query.period === "all" ? null : 7;
  const cutoff = days ? reportingCutoff(days) : null;
  const sessions = data.classes.filter((session) => (!query.course || session.course_id === query.course) && (!cutoff || !session.starts_at || Date.parse(session.starts_at) >= cutoff));
  const sessionIds = new Set(sessions.map((session) => session.id));
  const finalizedIds = new Set(sessions.filter((session) => session.status === "COMPLETED").map((session) => session.id));
  const verifiedIds = new Set(sessions.filter((session) => session.status === "COMPLETED" && session.verification_mode === "VERIFIED").map((session) => session.id));
  const finalized = data.attendance.filter((record) => verifiedIds.has(record.class_session_id));
  const total = finalized.length;
  const present = finalized.filter((record) => attended.has(record.status)).length;
  const late = finalized.filter((record) => record.status === "LATE").length;
  const absent = finalized.filter((record) => record.status === "ABSENT").length;
  const early = finalized.filter((record) => record.status === "EARLY_LEAVE").length;
  const recent = data.attendance.filter((record) => sessionIds.has(record.class_session_id)).sort((a, b) => (b.check_in_at ?? "").localeCompare(a.check_in_at ?? "")).slice(0, 6);
  const trend = sessions.filter((session) => session.status === "COMPLETED").sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")).slice(-7).map((session) => {
    const records = data.attendance.filter((record) => record.class_session_id === session.id);
    const value = session.verification_mode === "VERIFIED" && records.length ? Math.round(records.filter((record) => attended.has(record.status)).length / records.length * 100) : null;
    return { id: session.id, value, label: session.starts_at ? new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(session.starts_at)) : "Class" };
  });
  const breakdown = data.courses.map((course) => {
    const ids = new Set(sessions.filter((session) => session.course_id === course.id && session.status === "COMPLETED" && session.verification_mode === "VERIFIED").map((session) => session.id));
    const records = data.attendance.filter((record) => ids.has(record.class_session_id));
    return { course, rate: records.length ? Math.round(records.filter((record) => attended.has(record.status)).length / records.length * 100) : null };
  }).filter((item) => item.rate !== null);
  const actionable = sessions.find((session) => session.status === "OPEN") ?? sessions.find((session) => session.status === "DRAFT");

  return <main className={styles.page}>
    <EducationHeading eyebrow="ATTENDANCE" title="Attendance" description="Track and manage student attendance in real time." action={actionable ? <Link className={styles.primary} href={`/dashboard/attendance/${actionable.id}`}><ClipboardCheck size={18} aria-hidden="true" />Take attendance</Link> : undefined} />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <form className={styles.toolbar}>
      <label className={styles.search}><span className="sr-only">Class</span><select name="course" defaultValue={query.course ?? ""}><option value="">All classes</option>{data.courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>
      <label className={styles.search}><span className="sr-only">Time period</span><select name="period" defaultValue={query.period ?? "7"}><option value="7">This week</option><option value="30">Last 30 days</option><option value="all">All time</option></select><button className={styles.secondary} type="submit">Apply</button></label>
    </form>
    <section className={styles.metrics} aria-label="Attendance summary">
      <EducationMetric icon={CheckCircle2} value={percent(present, total)} label="Attendance rate" color="#18a66c" soft="#e6f8ef" />
      <EducationMetric icon={Clock3} value={percent(late, total)} label="Late rate" color="#f29a20" soft="#fff4df" />
      <EducationMetric icon={UserX} value={percent(absent, total)} label="Absence rate" color="#ff4765" soft="#ffeaf0" />
      <EducationMetric icon={LogOut} value={percent(early, total)} label="Early departures" color="#7c3aed" soft="#f0e9ff" />
    </section>
    <section className={styles.twoColumn}>
      <div className={styles.panel}><header className={styles.panelHeader}><div><h2>Attendance trend</h2><p>Verified sessions only; Standard mode has no assumed denominator</p></div></header>{trend.some((item) => item.value !== null) ? <div className={styles.chart} aria-label="Attendance trend chart">{trend.map((item) => <div className={styles.chartItem} key={item.id}><strong>{item.value === null ? "—" : `${item.value}%`}</strong><i className={styles.chartBar} style={{ height: `${item.value ?? 2}%` }} /><small>{item.label}</small></div>)}</div> : <EducationEmpty title="No finalized attendance yet" description="Finish your first class to see attendance insights." icon={CalendarCheck} />}</div>
      <div className={styles.panel}><header className={styles.panelHeader}><div><h2>Class breakdown</h2><p>Verified attendance rate</p></div></header>{breakdown.length ? <ul className={`${styles.breakdown} ${styles.panelBody}`}>{breakdown.map(({ course, rate }) => <li key={course.id}><strong>{course.code}</strong><span>{rate}%</span><span className={styles.progress}><i style={{ width: `${rate}%` }} /></span></li>)}</ul> : <EducationEmpty title="No class breakdown" description="Completed class records will appear here." />}</div>
    </section>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>Recent attendance</h2><p>Latest attendance submissions</p></div></header>{recent.length ? <ul className={styles.rows}>{recent.map((record) => {
      const student = data.students.find((item) => item.id === record.student_id);
      const session = data.classes.find((item) => item.id === record.class_session_id);
      const course = data.courses.find((item) => item.id === session?.course_id);
      return <li key={record.id}><span className={styles.avatar}>{initials(student?.full_name ?? "Student")}</span><Link className={styles.rowLink} href={`/dashboard/attendance/${record.class_session_id}`}><strong>{student?.full_name ?? "Student"}</strong><span>{course?.code ?? "Class"}</span></Link><span className={styles.rowEnd}><EducationStatus tone={statusTone(record.status)}>{record.status.replaceAll("_", " ")}</EducationStatus><small>{formatTime(record.check_in_at)}</small></span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></li>;
    })}</ul> : <EducationEmpty title="No attendance records yet" description="Verified arrivals will appear here after a class begins." icon={CalendarCheck} />}</section>
  </main>;
}
