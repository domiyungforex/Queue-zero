import { BookOpen, Plus } from "lucide-react";
import { LiveRefresh } from "@/components/realtime/refresh";
import { EducationEmpty, EducationHeading } from "@/components/school/education-ui";
import { SchoolForm, TextField, SelectField } from "@/components/school/forms";
import { CourseManagerRow } from "@/components/organization/course-manager-row";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getSchoolSnapshot } from "@/lib/school/data";
import { getOrganizationCoursesDetailed } from "@/lib/organization/cms-data";
import { getOrganizationTerminology } from "@/lib/organization/terminology";
import styles from "@/components/school/education-pages.module.css";
import "@/components/school/school.css";

type Props = {
  searchParams?: Promise<{ dept?: string; q?: string }>;
};

export default async function CoursesPage({ searchParams }: Props = {}) {
  const [membership, { snapshot: data, canManage }, detailedCourses, query] = await Promise.all([
    requireBusinessMembership(),
    getSchoolSnapshot(),
    getOrganizationCoursesDetailed(),
    searchParams,
  ]);

  const terms = getOrganizationTerminology(membership.institutionType, membership.organizationType);
  const isCmsAdmin = membership.workspaceOwnership === "ORGANIZATION" && canManage;

  const deptFilter = query?.dept;
  const searchFilter = query?.q?.trim().toLowerCase() || "";

  const filteredCourses = detailedCourses.filter((course) => {
    if (deptFilter && course.department_id !== deptFilter) return false;
    if (searchFilter && !`${course.code} ${course.title}`.toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  return (
    <main className={styles.page}>
      <EducationHeading
        eyebrow="ACADEMIC & OPERATIONAL MANAGEMENT"
        title={terms.operationalItemPlural}
        description={
          isCmsAdmin
            ? `Manage institutional curriculum, configure ${terms.operationalItemPlural.toLowerCase()}, and assign ${terms.assignedPersonnelPlural.toLowerCase()} to operational units.`
            : `Your assigned ${terms.operationalItemPlural.toLowerCase()} and operational classes.`
        }
        action={
          canManage ? (
            <a className={styles.primary} href="#course-setup">
              <Plus size={18} aria-hidden="true" />
              Add {terms.operationalItem}
            </a>
          ) : undefined
        }
      />
      <LiveRefresh topic={`school:${data.organization.id}`} authenticated />

      {/* Course List */}
      {filteredCourses.length ? (
        <section style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
          {filteredCourses.map((course) => (
            <CourseManagerRow
              key={course.id}
              courseId={course.id}
              courseCode={course.code}
              courseTitle={course.title}
              departmentName={course.department_name}
              facultyName={course.faculty_name}
              enrolledCount={course.enrolled_count}
              lecturers={course.lecturers}
              canManage={canManage}
            />
          ))}
        </section>
      ) : (
        <EducationEmpty
          title={`No ${terms.operationalItemPlural.toLowerCase()} found`}
          description={
            canManage
              ? `Select a ${terms.level2.toLowerCase()} below to add the first ${terms.operationalItem.toLowerCase()}.`
              : `Ask your department administrator to assign you to a ${terms.operationalItem.toLowerCase()}.`
          }
          href={canManage ? "#course-setup" : undefined}
          label={`Add ${terms.operationalItem}`}
          icon={BookOpen}
        />
      )}

      {/* Course Creation Form with Department Selection (Bug-Free!) */}
      {canManage && (
        <section id="course-setup" className={styles.formWrap} style={{ marginTop: "32px" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #ffd2bf",
              borderRadius: "20px",
              padding: "clamp(16px, 4vw, 24px)",
            }}
          >
            <div style={{ marginBottom: "18px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 750, margin: 0, color: "#17130f" }}>
                Add New {terms.operationalItem}
              </h2>
              <p style={{ fontSize: "13px", color: "#70665e", margin: "4px 0 0" }}>
                Establish a new {terms.operationalItem.toLowerCase()} under an existing {terms.level2.toLowerCase()}.
              </p>
            </div>

            <SchoolForm action="course" submit={`Create ${terms.operationalItem}`}>
              <SelectField
                name="department_id"
                label={terms.level2}
                options={data.departments}
              />
              <TextField name="code" label={`${terms.operationalItem} code`} maxLength={40} />
              <TextField name="title" label={`${terms.operationalItem} title`} />
            </SchoolForm>
          </div>
        </section>
      )}
    </main>
  );
}
