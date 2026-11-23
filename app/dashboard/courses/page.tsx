import { BookOpen, ChevronRight, Plus, UserCheck, UsersRound, UserX } from "lucide-react";
import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EducationEmpty, EducationHeading } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { SetupForms } from "@/components/school/forms";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getSchoolSnapshot } from "@/lib/school/data";
import "@/components/school/school.css";

export default async function CoursesPage() {
  const [membership, { snapshot: data, canManage }] = await Promise.all([requireBusinessMembership(), getSchoolSnapshot()]);
  const individual = membership.workspaceOwnership === "INDIVIDUAL";
  return <main className={styles.page}>
    <EducationHeading
      eyebrow={individual ? "TEACHING COURSES" : "CURRICULUM & LECTURERS"}
      title={individual ? "Your courses & classes" : "Courses & lecturer assignments"}
      description={individual ? "Manage your course structure, enroll students and schedule attendance sessions." : "Manage institution courses, assign designated lecturers to lead classes, and oversee student rosters."}
      action={<a className={styles.primary} href="#course-setup"><Plus size={18} aria-hidden="true" />Create class</a>}
    />
    <LiveRefresh topic={`school:${data.organization.id}`} authenticated />
    {data.courses.length ? <section className={styles.grid}>{data.courses.map((course) => {
      const roster = data.enrollments.filter((item) => item.course_id === course.id).length;
      const courseLecturers = data.lecturers.filter((item) => item.course_id === course.id);
      return <Link key={course.id} className={styles.card} href={`/dashboard/courses/${course.id}`}>
        <span className={styles.icon}><BookOpen size={21} aria-hidden="true" /></span>
        <span className={styles.cardCopy}>
          <strong>{course.code}</strong>
          <span>{course.title}</span>
          <span className={styles.meta}>
            <UsersRound size={13} aria-hidden="true" />
            {roster} {roster === 1 ? "student" : "students"}
            {!individual && (
              <>
                <span style={{ margin: "0 2px", color: "#d5e0d8" }}>•</span>
                {courseLecturers.length > 0 ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#16855b" }}>
                    <UserCheck size={13} aria-hidden="true" />
                    <span>{courseLecturers.map((l) => l.display_name).join(", ")}</span>
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#d94b14" }}>
                    <UserX size={13} aria-hidden="true" />
                    <span>Unassigned · Assign lecturer</span>
                  </span>
                )}
              </>
            )}
          </span>
        </span>
        <ChevronRight className={styles.chevron} size={18} aria-hidden="true" />
      </Link>;
    })}</section> : <EducationEmpty title="No classes yet" description={canManage ? "Add the required school structure, then create the first class below." : "Ask an administrator to create or assign a class."} href={canManage ? "#course-setup" : undefined} label="Start setup" icon={BookOpen} />}
    <section id="course-setup" className={styles.formWrap}><SetupForms snapshot={data} canManage={canManage} /></section>
  </main>;
}
