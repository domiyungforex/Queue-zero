import Image from "next/image";
import { Building2, CreditCard, GraduationCap, Settings2 } from "lucide-react";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { BusinessSelector } from "@/components/dashboard/business-selector";
import { MobileWorkspaceSwitcher } from "@/components/dashboard/mobile-workspace-switcher";
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { LiveRefresh } from "@/components/realtime/refresh";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { AccountMenuBackdrop } from "@/components/dashboard/account-menu-backdrop";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import type { WorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";
import type { Database } from "@/lib/db/database.types";
import styles from "./workspace-shell.module.css";
import { ServerResolvedAnalyticsIdentity } from "@/lib/analytics/identity";
import { WorkspaceAnalyticsContext } from "@/components/analytics/workspace-context";

type Membership = {
  businessId: string;
  businessName: string;
  role: Database["public"]["Enums"]["business_role"];
  workspaceOwnership?: Database["public"]["Enums"]["workspace_ownership"];
};

type Props = {
  children: React.ReactNode;
  membership: Membership & {
    organizationMode?: Database["public"]["Enums"]["organization_mode"];
    professionalCategory?: Database["public"]["Enums"]["professional_category"];
    organizationType?: Database["public"]["Enums"]["organization_type"];
    institutionType?: string;
  };
  memberships: Membership[];
  institutionTeaching: boolean;
  institutionStaffManagement: boolean;
  userName?: string | null;
  userImageUrl?: string | null;
  userId: string;
  notifications: WorkspaceNotificationSnapshot;
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WorkspaceDashboardShell({ children, membership, memberships, institutionTeaching, institutionStaffManagement, userName, userImageUrl, userId, notifications }: Props) {
  const navigation = {
    role: membership.role,
    mode: membership.organizationMode,
    workspaceOwnership: membership.workspaceOwnership,
    professionalCategory: membership.professionalCategory,
    organizationType: membership.organizationType,
    institution: Boolean(membership.institutionType),
    institutionTeaching,
    institutionStaffManagement,
  };
  const roleLabel = titleCase(membership.role);
  const isIndividual = membership.workspaceOwnership === "INDIVIDUAL";
  const isOrganizationCms = !isIndividual && (membership.role === "owner" || membership.role === "admin");
  const isLecturer = membership.role === "lecturer";
  const workspaceContextLabel = isOrganizationCms
    ? "Organization CMS"
    : isLecturer
      ? "Lecturer Workspace"
      : isIndividual
        ? "Personal Workspace"
        : "Operational Workspace";
  const initials = (userName ?? membership.businessName).split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const wordmark = TURNMARK_ASSETS.branding.wordmark;
  const education = membership.organizationMode === "SCHOOL" || membership.organizationMode === "HYBRID" || membership.organizationType === "UNIVERSITY_SCHOOL" || membership.professionalCategory === "LECTURER_TEACHER";
  const WorkspaceIcon = education ? GraduationCap : Building2;

  const workspaceType = membership.organizationMode ?? membership.workspaceOwnership ?? "ORGANIZATION";
  return <><ServerResolvedAnalyticsIdentity userId={userId} /><WorkspaceAnalyticsContext workspaceKey={membership.businessId} workspaceType={workspaceType} userRole={membership.role} /><div data-dashboard-shell="v2" className={styles.shell}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href="/dashboard" aria-label="TuRnMaRk dashboard"><Image src={wordmark.src} width={wordmark.width} height={wordmark.height} alt={wordmark.alt} priority /></a>
      <p className={styles.navCaption}>{isOrganizationCms ? "ORGANIZATION CMS" : "WORKSPACE"}</p>
      <DashboardNavigation {...navigation} variant="desktop" />
      <p className={styles.sidebarFoot}>TuRnMaRk keeps operational data inside the workspace you are authorized to use.</p>
    </aside>
    <div className={styles.body}>
      <header className={styles.header}>
        <div className={styles.identity}><span className={styles.workspaceIcon}><WorkspaceIcon size={18} /></span><div className={styles.identityCopy}><strong>{membership.businessName}</strong><span>{roleLabel} · {workspaceContextLabel}</span></div><LiveRefresh key={membership.businessId} topic={`business:${membership.businessId}`} authenticated /></div>
        <div className={styles.headerSwitcher}><BusinessSelector key={membership.businessId} businessId={membership.businessId} memberships={memberships} /></div>
        <div className={styles.account}><NotificationCenter key={`desktop:${membership.businessId}`} variant="desktop" businessId={membership.businessId} userId={userId} initial={notifications} /><AuthNavigation /></div>
      </header>
      <header className={styles.mobileHeader}>
        <a className={styles.mobileBrand} href="/dashboard" aria-label="TuRnMaRk dashboard"><Image src={wordmark.src} width={wordmark.width} height={wordmark.height} alt={wordmark.alt} priority /></a>
        <MobileWorkspaceSwitcher businessId={membership.businessId} memberships={memberships} contextLabel={education ? `${roleLabel} · School` : undefined} education={education} />
        <div className={styles.mobileHeaderActions}>
          <NotificationCenter key={`mobile:${membership.businessId}`} variant="mobile" businessId={membership.businessId} userId={userId} initial={notifications} />
          <details className={styles.mobileAccount}>
            <summary aria-label="Open account menu">{userImageUrl ? <Image src={userImageUrl} width={36} height={36} alt="" unoptimized /> : initials || "TM"}</summary>
            <AccountMenuBackdrop />
            <div className={styles.mobileAccountMenu} role="menu">
              {membership.role === "owner" && <><a href="/dashboard/settings"><Settings2 size={16} aria-hidden="true" />Workspace settings</a><a href="/dashboard/billing"><CreditCard size={16} aria-hidden="true" />Billing</a></>}
              <a href="/onboarding?new=workspace">Add workspace</a>
              <AuthNavigation showDashboard={false} />
            </div>
          </details>
        </div>
      </header>
      <main id="main" className={styles.main}>{children}</main>
      <footer className={styles.footer}><span>TuRnMaRk · People flow better.</span><span>{membership.businessName}</span></footer>
      <DashboardNavigation {...navigation} variant="mobile" />
    </div>
  </div></>;
}
