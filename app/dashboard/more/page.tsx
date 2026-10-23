import { BarChart3, Bell, BookOpen, BriefcaseBusiness, Building2, ChevronRight, CircleHelp, CreditCard, GraduationCap, ListOrdered, LockKeyhole, MapPin, Settings2, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { EducationHeading } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getInstitutionSnapshot } from "@/lib/institution/data";

const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function MenuLink({ href, icon: Icon, title, description }: { href: string; icon: typeof UserRound; title: string; description: string }) {
  return <Link className={styles.menuLink} href={href}><span className={styles.icon}><Icon size={18} aria-hidden="true" /></span><span><strong>{title}</strong><span>{description}</span></span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></Link>;
}

export default async function MorePage() {
  const membership = await requireBusinessMembership();
  const manager = membership.role === "owner" || membership.role === "admin";
  const individual = membership.workspaceOwnership === "INDIVIDUAL";
  const individualLecturer = individual && membership.professionalCategory === "LECTURER_TEACHER";
  const education = membership.organizationMode === "SCHOOL" || membership.organizationMode === "HYBRID" || membership.organizationType === "UNIVERSITY_SCHOOL" || individualLecturer;
  const institution = membership.institutionType && !manager ? await getInstitutionSnapshot() : null;
  const teaching = education && (manager || membership.role === "lecturer" || Boolean(institution?.snapshot.units.some(unit => unit.permissions.some(permission => permission.startsWith("course.") || permission.startsWith("attendance.")))));
  const manageStaff = manager || Boolean(institution?.snapshot.units.some(unit => unit.permissions.includes("unit.staff.manage")));
  const WorkspaceIcon = education ? GraduationCap : individual ? BriefcaseBusiness : Building2;
  const workspaceLabel = individual ? "Personal Workspace" : education ? "Education" : "Organization Workspace";
  return <div className={styles.page}>
    <EducationHeading eyebrow="MORE" title="More" description="Manage your workspace and account." />
    <div className={styles.menuSections}>
      <section><h2>Workspace</h2><div className={styles.menuCard}><div className={styles.workspaceCard}><span className={styles.icon}><WorkspaceIcon size={20} aria-hidden="true" /></span><span><strong>{membership.businessName}</strong><span>{titleCase(membership.role)} · {workspaceLabel}</span></span></div></div></section>
      <section><h2>Manage</h2><div className={styles.menuCard}>
        {teaching ? <MenuLink href="/dashboard/courses" icon={BookOpen} title="Class setup" description="Courses, optional rosters and schedules" /> : null}
        {membership.role !== "student" && !individualLecturer ? <MenuLink href="/dashboard/queues" icon={ListOrdered} title="Queues" description="Manage waiting customers and service flow" /> : null}
        {membership.role !== "student" && membership.institutionType ? <><MenuLink href="/dashboard/units" icon={Building2} title="Units" description="Departments and teams you can access" /><MenuLink href="/dashboard/services" icon={BriefcaseBusiness} title="Services" description="Queues and classes across your units" /></> : null}
        {manager && !individual ? <MenuLink href="/dashboard/locations" icon={MapPin} title="Locations" description="Manage workspace locations" /> : null}
        {teaching || (!education && manager) ? <MenuLink href={education ? "/dashboard/exports" : "/dashboard/analytics"} icon={BarChart3} title="Reports" description={education ? "Attendance insights and records" : "Queue activity and service insights"} /> : null}
        {manageStaff ? <MenuLink href={membership.institutionType ? "/dashboard/people" : "/dashboard/team"} icon={UsersRound} title="Team members" description="Roles and workspace access" /> : null}
        {membership.role === "owner" ? <MenuLink href="/dashboard/settings" icon={Settings2} title="Settings" description="Workspace details and preferences" /> : null}
        {membership.role === "owner" ? <MenuLink href="/dashboard/billing" icon={CreditCard} title="Billing" description="Plan and payment settings" /> : null}
      </div></section>
      <section><h2>Account</h2><div className={styles.menuCard}>
        <MenuLink href="/dashboard/notifications" icon={Bell} title="Notifications" description="Workspace updates and alerts" />
        <MenuLink href="/contact" icon={CircleHelp} title="Help & Support" description="Get help with TuRnMaRk" />
        <MenuLink href="/privacy" icon={LockKeyhole} title="Privacy Policy" description="How TuRnMaRk handles data" />
        <div className={`${styles.menuLink} ${styles.danger}`}><span className={styles.icon}><UserRound size={18} aria-hidden="true" /></span><AuthNavigation showDashboard={false} /><span /></div>
      </div></section>
    </div>
  </div>;
}
