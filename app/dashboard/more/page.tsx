import { BarChart3, ChevronRight, CircleHelp, CreditCard, GraduationCap, LockKeyhole, Settings2, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { EducationHeading } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { requireBusinessMembership } from "@/lib/business/membership";

const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function MenuLink({ href, icon: Icon, title, description }: { href: string; icon: typeof UserRound; title: string; description: string }) {
  return <Link className={styles.menuLink} href={href}><span className={styles.icon}><Icon size={18} aria-hidden="true" /></span><span><strong>{title}</strong><span>{description}</span></span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></Link>;
}

export default async function MorePage() {
  const membership = await requireBusinessMembership();
  const manager = membership.role === "owner" || membership.role === "admin";
  return <main className={styles.page}>
    <EducationHeading eyebrow="MORE" title="More" description="Manage your workspace and account." />
    <div className={styles.menuSections}>
      <section><h2>Workspace</h2><div className={styles.menuCard}><div className={styles.workspaceCard}><span className={styles.icon}><GraduationCap size={20} aria-hidden="true" /></span><span><strong>{membership.businessName}</strong><span>{titleCase(membership.role)} · Education</span></span><ChevronRight className={styles.chevron} size={17} aria-hidden="true" /></div></div></section>
      <section><h2>Manage</h2><div className={styles.menuCard}>
        <MenuLink href="/dashboard/exports" icon={BarChart3} title="Reports" description="Attendance insights and records" />
        {manager ? <MenuLink href="/dashboard/team" icon={UsersRound} title="Team members" description="Roles and workspace access" /> : null}
        {membership.role === "owner" ? <MenuLink href="/dashboard/settings" icon={Settings2} title="Settings" description="Workspace details and preferences" /> : null}
        {membership.role === "owner" ? <MenuLink href="/dashboard/billing" icon={CreditCard} title="Billing" description="Plan and payment settings" /> : null}
      </div></section>
      <section><h2>Account</h2><div className={styles.menuCard}>
        <MenuLink href="/contact" icon={CircleHelp} title="Help & Support" description="Get help with TuRnMaRk" />
        <MenuLink href="/privacy" icon={LockKeyhole} title="Privacy Policy" description="How TuRnMaRk handles data" />
        <div className={`${styles.menuLink} ${styles.danger}`}><span className={styles.icon}><UserRound size={18} aria-hidden="true" /></span><AuthNavigation showDashboard={false} /><span /></div>
      </div></section>
    </div>
  </main>;
}
