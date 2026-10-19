import { Bell, Building2, ChevronDown, Clock3, GraduationCap, ShieldCheck } from "lucide-react";
import { OrganizationModeForm } from "@/components/dashboard/organization-mode";
import { requireBusinessOwner } from "@/lib/business/membership";
import { getBusinessDetails } from "@/lib/dashboard/data";
import { BusinessSettingsForm } from "@/components/business/forms";
import { EducationHeading } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";

export default async function SettingsPage() {
  const [business, membership] = await Promise.all([getBusinessDetails(), requireBusinessOwner()]);
  return <main className={styles.page}>
    <EducationHeading eyebrow="SETTINGS" title="Settings" description="Manage your workspace and preferences." />
    <div className={styles.settingsGrid}>
      <div className={styles.menuSections}>
        <section><h2>Workspace</h2><div className={styles.menuCard}><div className={styles.workspaceCard}><span className={styles.icon}><GraduationCap size={20} aria-hidden="true" /></span><span><strong>{business.name}</strong><span>{business.industry} · {business.country_code}</span></span></div></div></section>
        <section><h2>Workspace details</h2><div className={styles.settingsDisclosure}>
          <details><summary><span className={styles.icon}><Building2 size={18} aria-hidden="true" /></span><span><strong>Profile information</strong><small>Name, workspace type and reporting timezone</small></span><ChevronDown size={17} aria-hidden="true" /></summary><div className={styles.disclosureBody}><BusinessSettingsForm business={business} /></div></details>
          <details><summary><span className={styles.icon}><GraduationCap size={18} aria-hidden="true" /></span><span><strong>Academic settings</strong><small>Classes, attendance and workspace modules</small></span><ChevronDown size={17} aria-hidden="true" /></summary><div className={styles.disclosureBody}><OrganizationModeForm mode={membership.organizationMode ?? "BUSINESS"} /></div></details>
          <div className={styles.settingsRow}><span className={styles.icon}><Clock3 size={18} aria-hidden="true" /></span><span><strong>Timezone</strong><small>{business.timezone}</small></span></div>
          <div className={styles.settingsRow}><span className={styles.icon}><Bell size={18} aria-hidden="true" /></span><span><strong>Notifications</strong><small>Realtime workspace updates are available from the header bell.</small></span></div>
        </div></section>
      </div>
      <aside className={`${styles.panel} ${styles.note}`}>
        <ShieldCheck size={22} aria-hidden="true" />
        <h2>Data &amp; Privacy</h2>
        <p>Student and attendance records are available only inside authorized workspaces. Public attendance access is limited to the class flow and identity checks configured by TuRnMaRk.</p>
        <h3>Existing records</h3><p>Changing workspace modules preserves existing queues, classes and attendance records.</p>
      </aside>
    </div>
  </main>;
}
