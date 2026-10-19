import { BarChart3, BookOpen, CalendarCheck, ChevronRight, Clock3, UserX } from "lucide-react";
import Link from "next/link";
import { EducationEmpty, EducationHeading, EducationMetric } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { schoolTime } from "@/lib/school/contracts";
import { getSchoolSnapshot } from "@/lib/school/data";

const attended = new Set(["PRESENT", "LATE", "EARLY_LEAVE", "INCOMPLETE", "FLAGGED"]);

export default async function ExportsPage() {
  const { snapshot: data } = await getSchoolSnapshot();
  const classes = data.classes.filter((item) => item.status === "COMPLETED").sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  const classIds = new Set(classes.map((item) => item.id));
  const records = data.attendance.filter((item) => classIds.has(item.class_session_id));
  const present = records.filter((item) => attended.has(item.status)).length;
  const late = records.filter((item) => item.status === "LATE").length;
  const absent = records.filter((item) => item.status === "ABSENT").length;
  const rate = records.length ? `${Math.round(present / records.length * 100)}%` : "—";
  const trend = classes.slice(0, 7).reverse().map((session) => {
    const rows = records.filter((item) => item.class_session_id === session.id);
    return { session, value: rows.length ? Math.round(rows.filter((item) => attended.has(item.status)).length / rows.length * 100) : null };
  });
  const performance = data.courses.map((course) => {
    const ids = new Set(classes.filter((item) => item.course_id === course.id).map((item) => item.id));
    const rows = records.filter((item) => ids.has(item.class_session_id));
    return { course, value: rows.length ? Math.round(rows.filter((item) => attended.has(item.status)).length / rows.length * 100) : null };
  }).filter((item): item is { course: (typeof data.courses)[number]; value: number } => item.value !== null);

  return <main className={styles.page}>
    <EducationHeading eyebrow="REPORTS" title="Reports" description="Insights and analytics for your classes and students." />
    <section className={styles.metrics} aria-label="Report summary">
      <EducationMetric icon={BarChart3} value={rate} label="Attendance rate" color="#18a66c" soft="#e6f8ef" />
      <EducationMetric icon={Clock3} value={late} label="Late arrivals" color="#f29a20" soft="#fff4df" />
      <EducationMetric icon={UserX} value={absent} label="Total absences" color="#ff4765" soft="#ffeaf0" />
      <EducationMetric icon={BookOpen} value={data.classes.filter((item) => item.status === "OPEN").length} label="Active classes" color="#7c3aed" soft="#f0e9ff" />
    </section>
    {!records.length ? <EducationEmpty title="No finalized attendance yet" description="Finish a class session to start seeing attendance insights." href="/dashboard/attendance" label="Open attendance" icon={CalendarCheck} /> : <>
      <section className={styles.twoColumn}>
        <div className={styles.panel}><header className={styles.panelHeader}><div><h2>Attendance trend</h2><p>Finalized class sessions</p></div></header><div className={styles.chart} role="img" aria-label="Attendance percentage for recent finalized classes">{trend.map(({ session, value }) => <div className={styles.chartItem} key={session.id}><strong>{value === null ? "—" : `${value}%`}</strong><i className={styles.chartBar} style={{ height: `${Math.max(value ?? 0, 3)}%` }} /><small>{session.starts_at ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(session.starts_at)) : "Class"}</small></div>)}</div></div>
        <div className={styles.panel}><header className={styles.panelHeader}><div><h2>Class performance</h2><p>Verified attendance rate</p></div></header><ul className={`${styles.breakdown} ${styles.panelBody}`}>{performance.map(({ course, value }) => <li key={course.id}><strong>{course.code}</strong><span>{value}%</span><span className={styles.progress}><i style={{ width: `${value}%` }} /></span></li>)}</ul></div>
      </section>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>Recent reports</h2><p>Open a register to export PDF, CSV or XLSX.</p></div></header>{classes.slice(0, 12).map((session) => {
        const course = data.courses.find((item) => item.id === session.course_id);
        const rows = records.filter((item) => item.class_session_id === session.id);
        return <Link className={styles.reportRow} href={`/dashboard/attendance/${session.id}`} key={session.id}><span><strong>{course?.code ?? "Class"} · {course?.title ?? "Attendance register"}</strong><span>{schoolTime(session.starts_at)} · {rows.length} {rows.length === 1 ? "record" : "records"}</span></span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></Link>;
      })}</section>
    </>}
  </main>;
}
