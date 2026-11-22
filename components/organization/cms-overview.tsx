import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Layers,
  Plus,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { LiveRefresh } from "@/components/realtime/refresh";
import { PageHeading } from "@/components/ui/workspace";
import { getOrganizationCmsOverview } from "@/lib/organization/cms-data";
import { getOrganizationTerminology } from "@/lib/organization/terminology";
import styles from "./cms-overview.module.css";

type Props = {
  institutionType?: string | null;
  organizationType?: string | null;
  organizationName: string;
};

export async function OrganizationCmsOverview({
  institutionType,
  organizationType,
  organizationName,
}: Props) {
  const [stats] = await Promise.all([getOrganizationCmsOverview()]);
  const terms = getOrganizationTerminology(institutionType, organizationType);

  return (
    <div className={styles.container}>
      <PageHeading
        eyebrow="ORGANIZATION MANAGEMENT CMS"
        title={organizationName}
        description="Centralized administration, organizational hierarchy, personnel delegation, and institutional oversight."
        action={
          <div className={styles.headerActions}>
            <Link className="button-secondary" href="/dashboard/structure">
              <Layers size={16} aria-hidden="true" />
              Manage {terms.level1Plural} & {terms.level2Plural}
            </Link>
            <Link className="button-primary" href="/dashboard/courses#create">
              <Plus size={16} aria-hidden="true" />
              Add {terms.operationalItem}
            </Link>
          </div>
        }
      />
      <LiveRefresh topic={`business:${stats.organization_id}`} authenticated />

      {/* Primary KPI Grid */}
      <section className={styles.kpiGrid} aria-label="Organizational statistics">
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: "#eef2ff", color: "#4f46e5" }}>
            <Layers size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{terms.level1Plural}</span>
            <strong className={styles.kpiValue}>{stats.total_faculties}</strong>
            <span className={styles.kpiSub}>Organizational divisions</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: "#fdf4ff", color: "#c026d3" }}>
            <Building2 size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{terms.level2Plural}</span>
            <strong className={styles.kpiValue}>{stats.total_departments}</strong>
            <span className={styles.kpiSub}>Academic & operational units</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: "#ecfdf5", color: "#059669" }}>
            <BookOpen size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{terms.operationalItemPlural}</span>
            <strong className={styles.kpiValue}>{stats.total_courses}</strong>
            <span className={styles.kpiSub}>Active curriculum / services</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: "#fff7ed", color: "#ea580c" }}>
            <UserCheck size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{terms.assignedPersonnelPlural}</span>
            <strong className={styles.kpiValue}>{stats.total_personnel}</strong>
            <span className={styles.kpiSub}>Assigned staff & instructors</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: "#f0fdf4", color: "#16a34a" }}>
            <ClipboardCheck size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Today’s Check-ins</span>
            <strong className={styles.kpiValue}>{stats.today_checkins}</strong>
            <span className={styles.kpiSub}>Attendance registered</span>
          </div>
        </div>
      </section>

      {/* Realtime Live Activity Banner */}
      <section className={styles.liveBanner}>
        <div className={styles.liveDot} />
        <div className={styles.liveText}>
          <strong>
            {stats.active_sessions > 0
              ? `${stats.active_sessions} Active ${terms.sessionPlural} Currently Live`
              : `No Active ${terms.sessionPlural} Right Now`}
          </strong>
          <span>
            Operational sessions are independently created and managed by authorized {terms.assignedPersonnelPlural.toLowerCase()} in their delegated workspaces.
          </span>
        </div>
        <Link href="/dashboard/attendance" className={styles.oversightLink}>
          View Institutional Attendance Oversight <ArrowRight size={15} />
        </Link>
      </section>

      {/* Main CMS Navigation Quadrants */}
      <div className={styles.quadrants}>
        <div className={styles.quadCard}>
          <div className={styles.quadHeader}>
            <div className={styles.quadIcon} style={{ background: "#eef2ff", color: "#4f46e5" }}>
              <Layers size={20} />
            </div>
            <div>
              <h3>Organizational Structure</h3>
              <p>Establish faculties, departments, and units</p>
            </div>
          </div>
          <p className={styles.quadDescription}>
            Manage institutional hierarchy. Add faculties, establish departments, and bind operational units with delegated permissions.
          </p>
          <div className={styles.quadActions}>
            <Link className="button-secondary" href="/dashboard/structure">
              Structure & Hierarchy <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.quadCard}>
          <div className={styles.quadHeader}>
            <div className={styles.quadIcon} style={{ background: "#ecfdf5", color: "#059669" }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3>{terms.operationalItemPlural} & Assignments</h3>
              <p>Curriculum, programs, and staff allocation</p>
            </div>
          </div>
          <p className={styles.quadDescription}>
            Create courses, bind them to departments, and assign {terms.assignedPersonnelPlural.toLowerCase()} to manage them in their unit workspaces.
          </p>
          <div className={styles.quadActions}>
            <Link className="button-secondary" href="/dashboard/courses">
              Manage {terms.operationalItemPlural} <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.quadCard}>
          <div className={styles.quadHeader}>
            <div className={styles.quadIcon} style={{ background: "#fff7ed", color: "#ea580c" }}>
              <UsersRound size={20} />
            </div>
            <div>
              <h3>People & Invitations</h3>
              <p>Invite personnel and assign role permissions</p>
            </div>
          </div>
          <p className={styles.quadDescription}>
            Invite new or existing TuRnMaRk users by email. Assign them as {terms.assignedPersonnelPlural}, unit heads, or administrators with scoped access.
          </p>
          <div className={styles.quadActions}>
            <Link className="button-secondary" href="/dashboard/people">
              People & Roles <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.quadCard}>
          <div className={styles.quadHeader}>
            <div className={styles.quadIcon} style={{ background: "#fdf4ff", color: "#c026d3" }}>
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3>Attendance Oversight</h3>
              <p>Consolidated reports across all departments</p>
            </div>
          </div>
          <p className={styles.quadDescription}>
            Realtime institutional oversight. Filter attendance records by faculty, department, course, or date. Review exceptions and export audit records.
          </p>
          <div className={styles.quadActions}>
            <Link className="button-secondary" href="/dashboard/attendance">
              Attendance Oversight <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
