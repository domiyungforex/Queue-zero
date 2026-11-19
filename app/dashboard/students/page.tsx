import { ChevronRight, Plus, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EducationEmpty, EducationHeading, EducationStatus, initials } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { EnrollmentForm } from "@/components/school/forms";
import { StudentCorrectionForm } from "@/components/school/student-correction-form";
import { getSchoolSnapshot } from "@/lib/school/data";

type StudentFilter = "all" | "present" | "absent" | "late";
const tone = (status?: string) => status === "PRESENT" ? "success" as const : status === "ABSENT" ? "danger" as const : status === "LATE" ? "warning" as const : "muted" as const;

export default async function StudentsPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ q?: string; filter?: string; page?: string }> } = {}) {
  const [{ snapshot: data, canManage }, query] = await Promise.all([getSchoolSnapshot(), searchParams]);
  const search = query.q?.trim().toLocaleLowerCase() ?? "";
  const filter: StudentFilter = ["present", "absent", "late"].includes(query.filter ?? "") ? query.filter as StudentFilter : "all";
  const latestByStudent = new Map<string, (typeof data.attendance)[number]>();
  for (const record of data.attendance.slice().sort((a, b) => (b.check_in_at ?? "").localeCompare(a.check_in_at ?? ""))) if (!latestByStudent.has(record.student_id)) latestByStudent.set(record.student_id, record);
  const students = data.students.filter((student) => {
    const status = latestByStudent.get(student.id)?.status.toLocaleLowerCase();
    const matches = !search || `${student.full_name} ${student.matric_number}`.toLocaleLowerCase().includes(search);
    return matches && (filter === "all" || status === filter);
  });
  const pageSize = 40;
  const pageCount = Math.max(1, Math.ceil(students.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const visibleStudents = students.slice((page - 1) * pageSize, page * pageSize);
  const tabs: { value: StudentFilter; label: string }[] = [{ value: "all", label: "All" }, { value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "late", label: "Late" }];

  return <main className={styles.page}>
    <EducationHeading eyebrow="STUDENTS" title="Students" description="Manage your students and view details." action={data.courses.length ? <a className={styles.primary} href="#import-roster"><Plus size={18} aria-hidden="true" />Add students</a> : undefined} />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    <section className={styles.panel}>
      <p>Students register once, then check in with a matriculation number. These links are for this institution only.</p>
      <p><a href={`/attend/register?org=${data.organization.id}`}>Student registration</a> · <a href={`/attend/check?org=${data.organization.id}`}>Attendance check-in</a></p>
    </section>
    <form className={styles.toolbar} role="search"><label className={styles.search}><Search size={17} aria-hidden="true" /><span className="sr-only">Search students</span><input name="q" type="search" defaultValue={query.q} placeholder="Name, matric or JAMB number" /><input type="hidden" name="filter" value={filter} /></label><button className={styles.secondary} type="submit">Search</button></form>
    <nav className={styles.filters} aria-label="Filter students">{tabs.map((tab) => <Link className={styles.tab} data-active={filter === tab.value} key={tab.value} href={{ pathname: "/dashboard/students", query: { ...(query.q ? { q: query.q } : {}), ...(tab.value === "all" ? {} : { filter: tab.value }) } }}>{tab.label}</Link>)}</nav>
    {visibleStudents.length ? <section className={styles.panel} aria-label="Students"><ul className={styles.rows}>{visibleStudents.map((student) => {
      const latest = latestByStudent.get(student.id);
      const courseCodes = data.enrollments.filter((item) => item.student_id === student.id).map((item) => data.courses.find((course) => course.id === item.course_id)?.code).filter(Boolean).join(", ");
      return <li key={student.id}><span className={styles.avatar}>{initials(student.full_name)}</span><span className={styles.rowMain}><strong>{student.full_name}</strong><span>{student.matric_number} · {courseCodes || "No class assigned"}</span></span><span className={styles.rowEnd}>{latest ? <EducationStatus tone={tone(latest.status)}>{latest.status.replaceAll("_", " ")}</EducationStatus> : <EducationStatus tone="muted">No record</EducationStatus>}</span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></li>;
    })}</ul>{pageCount > 1 ? <p>{page > 1 ? <Link href={{ pathname: "/dashboard/students", query: { ...(query.q ? { q: query.q } : {}), ...(filter === "all" ? {} : { filter }), page: String(page - 1) } }}>Previous</Link> : null} Page {page} of {pageCount}. {page < pageCount ? <Link href={{ pathname: "/dashboard/students", query: { ...(query.q ? { q: query.q } : {}), ...(filter === "all" ? {} : { filter }), page: String(page + 1) } }}>Next</Link> : null} Photographs are not loaded with this list.</p> : null}</section> : <EducationEmpty title={search || filter !== "all" ? "No matching students" : "No students yet"} description={search || filter !== "all" ? "Try another search or attendance status." : "Import the official roster with each student’s name and matric number."} href={data.courses.length ? "#import-roster" : "/dashboard/courses?create=1#course-setup"} label={data.courses.length ? "Add students" : "Create a class"} icon={UsersRound} />}
    {canManage && data.students.length ? <section className={`${styles.panel} ${styles.formWrap}`}><StudentCorrectionForm students={data.students} departments={data.departments} /></section> : null}
    {data.courses.length ? <section id="import-roster" className={`${styles.panel} ${styles.formWrap}`}><EnrollmentForm snapshot={data} /></section> : null}
  </main>;
}
