import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Layers,
  ListOrdered,
  LockKeyhole,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { EducationHeading } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";
import { requireBusinessMembership } from "@/lib/business/membership";

const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function MenuLink({ href, icon: Icon, title, description }: { href: string; icon: typeof UserRound; title: string; description: string }) {
  return (
    <Link className={styles.menuLink} href={href}>
      <span className={styles.icon}><Icon size={18} aria-hidden="true" /></span>
      <span><strong>{title}</strong><span>{description}</span></span>
      <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
    </Link>
  );
}

export default async function MorePage() {
  const membership = await requireBusinessMembership();
  const isIndividual = membership.workspaceOwnership === "INDIVIDUAL";
  const manager = !isIndividual && (membership.role === "owner" || membership.role === "admin");
  const isLecturer = membership.role === "lecturer";
  const owner = membership.role === "owner";

  return (
    <main className={styles.page}>
      <EducationHeading eyebrow="MORE" title="More" description="Manage your workspace and account navigation." />
      <div className={styles.menuSections}>
        <section>
          <h2>Active Workspace</h2>
          <div className={styles.menuCard}>
            <div className={styles.workspaceCard}>
              <span className={styles.icon}><GraduationCap size={20} aria-hidden="true" /></span>
              <span>
                <strong>{membership.businessName}</strong>
                <span>{titleCase(membership.role)} · {manager ? "Organization CMS" : isLecturer ? "Lecturer Workspace" : isIndividual ? "Personal Workspace" : "Workspace"}</span>
              </span>
              <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Organization CMS Management Area */}
        {manager && (
          <section>
            <h2>Organization CMS</h2>
            <div className={styles.menuCard}>
              <MenuLink href="/dashboard/structure" icon={Layers} title="Organizational Structure" description="Faculties, departments, and units" />
              <MenuLink href="/dashboard/people" icon={UsersRound} title="People & Roles" description="Invite personnel and manage responsibilities" />
              <MenuLink href="/dashboard/courses" icon={BookOpen} title="Courses & Services" description="Curriculum and service directory" />
              <MenuLink href="/dashboard/attendance" icon={ClipboardCheck} title="Attendance Oversight" description="Institution-wide attendance records" />
              <MenuLink href="/dashboard/queues" icon={ListOrdered} title="Queues" description="Virtual queuing services" />
              <MenuLink href="/dashboard/bookings" icon={CalendarClock} title="Bookings" description="Appointments and schedules" />
              <MenuLink href="/dashboard/exports" icon={BarChart3} title="Reports & Exports" description="Data summaries and audit records" />
            </div>
          </section>
        )}

        {/* Lecturer Workspace Area */}
        {isLecturer && (
          <section>
            <h2>Lecturer Actions</h2>
            <div className={styles.menuCard}>
              <MenuLink href="/dashboard/courses" icon={BookOpen} title="My Assigned Courses" description="View syllabus and course rosters" />
              <MenuLink href="/dashboard/classes" icon={CalendarDays} title="Classes & Sessions" description="Upcoming and past lecture periods" />
              <MenuLink href="/dashboard/attendance" icon={ClipboardCheck} title="Live Attendance" description="Start and monitor student check-ins" />
              <MenuLink href="/dashboard/students" icon={UsersRound} title="Students Roster" description="View enrolled students" />
              <MenuLink href="/dashboard/exports" icon={BarChart3} title="Course Reports" description="Export attendance summaries" />
            </div>
          </section>
        )}

        {/* Settings & Admin Controls */}
        <section>
          <h2>Preferences & Billing</h2>
          <div className={styles.menuCard}>
            <MenuLink href="/dashboard/notifications" icon={Bell} title="Notifications" description="Workspace updates and activity" />
            {(manager || isIndividual) && <MenuLink href="/dashboard/settings" icon={Settings2} title="Workspace Settings" description="Profile and operational preferences" />}
            {owner && <MenuLink href="/dashboard/billing" icon={CreditCard} title="Billing & Plans" description="Subscription and payment management" />}
          </div>
        </section>

        {/* Support & Account */}
        <section>
          <h2>Account & Support</h2>
          <div className={styles.menuCard}>
            <MenuLink href="/contact" icon={CircleHelp} title="Help & Support" description="Get help with TuRnMaRk" />
            <MenuLink href="/privacy" icon={LockKeyhole} title="Privacy Policy" description="How TuRnMaRk handles data" />
            <div className={`${styles.menuLink} ${styles.danger}`}>
              <span className={styles.icon}><UserRound size={18} aria-hidden="true" /></span>
              <AuthNavigation showDashboard={false} />
              <span />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
