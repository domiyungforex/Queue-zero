import { CalendarCheck, ChevronRight, FileDown } from "lucide-react";
import Link from "next/link";
import { EducationEmpty, EducationHeading } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { schoolTime } from "@/lib/school/contracts";
import { getSchoolSnapshot } from "@/lib/school/data";

export default async function ExportsPage() {
  const { snapshot: data } = await getSchoolSnapshot();
  const classes = data.classes.filter((item) => item.status === "COMPLETED").sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
  return <main className={styles.page}>
    <EducationHeading eyebrow="REPORTS" title="Reports" description="Finalized attendance records, ready to review and export." />
    {classes.length ? <section className={styles.panel}><header className={styles.panelHeader}><div><h2>Recent reports</h2><p>Access is checked again for every register and export.</p></div><FileDown size={20} aria-hidden="true" /></header>{classes.map((session) => {
      const course = data.courses.find((item) => item.id === session.course_id);
      const records = data.attendance.filter((item) => item.class_session_id === session.id);
      return <Link className={styles.reportRow} href={`/dashboard/attendance/${session.id}`} key={session.id}><span><strong>{course?.code ?? "Class"} · {course?.title ?? "Attendance register"}</strong><span>{schoolTime(session.starts_at)} · {records.length} {records.length === 1 ? "record" : "records"}</span></span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></Link>;
    })}</section> : <EducationEmpty title="No finalized registers" description="Finish your first class to create an official attendance report." href="/dashboard/attendance" label="Open attendance" icon={CalendarCheck} />}
  </main>;
}
