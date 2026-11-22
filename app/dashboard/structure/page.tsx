import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Layers,
  Plus,
} from "lucide-react";
import { LiveRefresh } from "@/components/realtime/refresh";
import { PageHeading } from "@/components/ui/workspace";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getSchoolSnapshot } from "@/lib/school/data";
import { getOrganizationTerminology } from "@/lib/organization/terminology";
import { SchoolForm, TextField, SelectField } from "@/components/school/forms";
import styles from "./structure.module.css";

export const metadata: Metadata = {
  title: "Organizational Structure — TuRnMaRk CMS",
  description: "Establish and manage faculties, divisions, departments and operational units.",
};

export default async function OrganizationStructurePage() {
  const membership = await requireBusinessMembership();
  const { snapshot: schoolData, canManage } = await getSchoolSnapshot();
  const terms = getOrganizationTerminology(membership.institutionType, membership.organizationType);

  // Group departments by faculty
  const deptsByFaculty = new Map<string, typeof schoolData.departments>();
  for (const dept of schoolData.departments) {
    const list = deptsByFaculty.get(dept.faculty_id) || [];
    list.push(dept);
    deptsByFaculty.set(dept.faculty_id, list);
  }

  // Count courses per department
  const coursesByDept = new Map<string, number>();
  for (const course of schoolData.courses) {
    coursesByDept.set(course.department_id, (coursesByDept.get(course.department_id) || 0) + 1);
  }

  return (
    <div className={styles.container}>
      <PageHeading
        eyebrow="ORGANIZATIONAL HIERARCHY"
        title={`${terms.level1Plural} & ${terms.level2Plural}`}
        description={`Establish and manage the organizational tree for ${schoolData.organization.name}.`}
        action={
          canManage && (
            <div className={styles.actionRow}>
              <a className="button-secondary" href="#add-department">
                <Plus size={16} /> Add {terms.level2}
              </a>
              <a className="button-primary" href="#add-faculty">
                <Plus size={16} /> Add {terms.level1}
              </a>
            </div>
          )
        }
      />
      <LiveRefresh topic={`school:${schoolData.organization.id}`} authenticated />

      {/* Structural Hierarchy Tree */}
      <section className={styles.treeSection}>
        <div className={styles.treeHeader}>
          <div className={styles.treeIconWrap}>
            <Layers size={20} />
          </div>
          <div>
            <h2>Organizational Tree</h2>
            <p>
              {schoolData.faculties.length} {terms.level1Plural.toLowerCase()} · {schoolData.departments.length} {terms.level2Plural.toLowerCase()}
            </p>
          </div>
        </div>

        {schoolData.faculties.length > 0 ? (
          <div className={styles.facultyList}>
            {schoolData.faculties.map((faculty) => {
              const depts = deptsByFaculty.get(faculty.id) || [];
              return (
                <div key={faculty.id} className={styles.facultyCard}>
                  <div className={styles.facultyHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={styles.facultyBadge}>{terms.level1.toUpperCase()}</span>
                      <h3 className={styles.facultyTitle}>{faculty.name}</h3>
                    </div>
                    <span className={styles.deptCount}>
                      {depts.length} {depts.length === 1 ? terms.level2 : terms.level2Plural}
                    </span>
                  </div>

                  {depts.length > 0 ? (
                    <div className={styles.departmentGrid}>
                      {depts.map((dept) => {
                        const courseCount = coursesByDept.get(dept.id) || 0;
                        return (
                          <div key={dept.id} className={styles.deptCard}>
                            <div className={styles.deptTop}>
                              <Building2 size={16} className={styles.deptIcon} />
                              <strong className={styles.deptName}>{dept.name}</strong>
                            </div>
                            <div className={styles.deptBottom}>
                              <span>
                                {courseCount} {courseCount === 1 ? terms.operationalItem : terms.operationalItemPlural}
                              </span>
                              <Link
                                href={`/dashboard/courses?dept=${dept.id}`}
                                className={styles.viewCoursesLink}
                              >
                                View <ChevronRight size={14} />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.emptyDeptNotice}>
                      <span>No {terms.level2Plural.toLowerCase()} created under this {terms.level1.toLowerCase()} yet.</span>
                      {canManage && (
                        <a href="#add-department" className={styles.inlineAddDept}>
                          + Add {terms.level2}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Layers size={36} />
            <h3>No {terms.level1Plural.toLowerCase()} established yet</h3>
            <p>Establish your first {terms.level1.toLowerCase()} and {terms.level2.toLowerCase()} using the form below.</p>
          </div>
        )}
      </section>

      {/* Forms Section for Admins */}
      {canManage && (
        <section className={styles.formsSection}>
          <div id="add-faculty" className={styles.formCard}>
            <div className={styles.formCardHeader}>
              <Plus size={18} />
              <h3>Add New {terms.level1}</h3>
            </div>
            <p className={styles.formCardSub}>
              Establish a new overarching {terms.level1.toLowerCase()} (e.g. Faculty of Engineering, Operations Division).
            </p>
            <SchoolForm action="faculty" submit={`Create ${terms.level1}`}>
              <TextField name="name" label={`${terms.level1} name`} />
            </SchoolForm>
          </div>

          <div id="add-department" className={styles.formCard}>
            <div className={styles.formCardHeader}>
              <Building2 size={18} />
              <h3>Add New {terms.level2}</h3>
            </div>
            <p className={styles.formCardSub}>
              Establish a department under a {terms.level1.toLowerCase()} and automatically provision its operational unit.
            </p>
            <SchoolForm action="department" submit={`Create ${terms.level2}`}>
              <SelectField name="faculty_id" label={terms.level1} options={schoolData.faculties} />
              <TextField name="name" label={`${terms.level2} name`} />
            </SchoolForm>
          </div>
        </section>
      )}
    </div>
  );
}
