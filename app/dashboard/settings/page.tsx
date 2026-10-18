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
        <section className={`${styles.panel} ${styles.formWrap}`}><BusinessSettingsForm business={business} /></section>
        <section className={`${styles.panel} ${styles.formWrap}`}><OrganizationModeForm mode={membership.organizationMode ?? "BUSINESS"} /></section>
      </div>
      <aside className={`${styles.panel} ${styles.note}`}>
        <h2>Data & Privacy</h2>
        <p>Student and attendance records are available only inside authorized workspaces. Public attendance access is limited to the class flow and identity checks already configured by TuRnMaRk.</p>
        <h3>Workspace</h3><p>{business.name} · {business.industry}</p>
        <h3>Timezone</h3><p>{business.timezone}</p>
        <h3>Country</h3><p>{business.country_code}</p>
        <h3>Existing records</h3><p>Changing workspace modules preserves existing queues, classes and attendance records.</p>
      </aside>
    </div>
  </main>;
}
