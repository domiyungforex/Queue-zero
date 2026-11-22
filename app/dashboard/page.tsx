import Link from "next/link";
import { ArrowUpRight, CheckCheck, Clock3, Plus, UserRound, Users } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { IndividualWorkspaceOverview } from "@/components/dashboard/individual-overview";
import { OrganizationCmsOverview } from "@/components/organization/cms-overview";
import { LecturerWorkspaceOverview } from "@/components/school/lecturer-workspace-overview";
import { OrganizationSetupStatus } from "@/components/organization/setup-status";
import { ProfessionalOverview } from "@/components/professional/overview";
import { DashboardWelcomeBanner } from "@/components/ui/turnmark-system";
import { PageHeading, StatCard, duration } from "@/components/ui/workspace";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { getOrganizationWorkspaceProfile } from "@/lib/organization/data";
import { getBusinessMetrics } from "@/lib/queue/console";

type DashboardPageProps = { searchParams?: Promise<{ onboarding?: string | string[] }> };

export default async function Page({ searchParams }: DashboardPageProps = {}) {
  const [membership, user] = await Promise.all([
    requireBusinessMembership(),
    currentUser().catch(() => null),
  ]);
  const query = await searchParams;
  const onboardingComplete = query?.onboarding === "complete" && Boolean(membership.onboardingCompletedAt);
  const success = onboardingComplete ? (
    <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      Your workspace is ready.
    </div>
  ) : null;

  const organizationProfile =
    membership.workspaceOwnership === "ORGANIZATION" ? await getOrganizationWorkspaceProfile() : null;
  const organizationStatus = organizationProfile ? <OrganizationSetupStatus profile={organizationProfile} /> : null;

  // 1. Student / Attendee Role
  if (membership.role === "student") {
    return (
      <>
        {success}
        <PageHeading
          eyebrow="YOUR WORKSPACE"
          title={membership.businessName}
          description="Use the workspace switcher above to move between organizations you belong to."
        />
      </>
    );
  }

  // 2. Individual Workspace (Independent User, not an organization manager)
  if (membership.workspaceOwnership === "INDIVIDUAL") {
    if (membership.professionalCategory && membership.professionalCategory !== "LECTURER_TEACHER") {
      return (
        <>
          {success}
          <ProfessionalOverview
            category={membership.professionalCategory}
            canManage={membership.role === "owner" || membership.role === "admin"}
          />
        </>
      );
    }
    return (
      <>
        {success}
        <IndividualWorkspaceOverview
          userName={user?.fullName || user?.firstName}
          businessName={membership.businessName}
        />
      </>
    );
  }

  // 3. Lecturer / Instructor Operational Workspace
  // When user is a lecturer in an institution, give them the focused operational workspace!
  if (membership.role === "lecturer") {
    return (
      <>
        {success}
        <LecturerWorkspaceOverview
          organizationName={membership.businessName}
          userName={user?.fullName || user?.firstName}
        />
      </>
    );
  }

  // 4. Organization CMS (For Organization Owners & Administrators)
  // Designed for organizational hierarchy, delegation, faculty/department management, and oversight!
  const isEducationOrInstitution =
    Boolean(membership.institutionType) ||
    membership.organizationMode === "SCHOOL" ||
    membership.organizationMode === "HYBRID" ||
    membership.organizationType === "UNIVERSITY_SCHOOL";

  if (isEducationOrInstitution && (membership.role === "owner" || membership.role === "admin")) {
    return (
      <>
        {success}
        {organizationStatus}
        <OrganizationCmsOverview
          institutionType={membership.institutionType}
          organizationType={membership.organizationType}
          organizationName={membership.businessName}
        />
      </>
    );
  }

  // 5. Default Business Organization Dashboard (Queues & Operational Services)
  const [queues, metrics] = await Promise.all([getDashboardQueues(), getBusinessMetrics()]);
  const openQueues = queues.filter((queue) => queue.status === "open").length;

  return (
    <>
      {success}
      {organizationStatus}
      <PageHeading
        eyebrow="LET’S MAKE TODAY FLOW"
        title="Your day, at a glance."
        description="A little less queue chaos. A little more personal service."
        action={
          (membership.role === "owner" || membership.role === "admin") && (
            <Link className="button-primary" href="/dashboard/queues/new">
              <Plus size={18} />
              Create queue
            </Link>
          )
        }
      />
      <DashboardWelcomeBanner
        eyebrow={`${openQueues} OPEN ${openQueues === 1 ? "QUEUE" : "QUEUES"}`}
        title="People arrive. Your team keeps moving."
        description="The illustration supports the workspace while every number below stays connected to actual queue activity."
        character="businessProfessional"
      />
      <div className="metrics-grid">
        <StatCard label="Waiting now" value={metrics.waiting} icon={<Users size={20} />} note="Across your accessible queues" />
        <StatCard label="Serving now" value={metrics.serving} icon={<UserRound size={20} />} note="One person at a time" />
        <StatCard label="Served today" value={metrics.completed_today} icon={<CheckCheck size={20} />} note="Completed customer visits" />
        <StatCard label="Average wait" value={duration(metrics.average_wait_seconds)} icon={<Clock3 size={20} />} note="Last 7 days · until called" />
      </div>
      <div className="section-toolbar">
        <h2>Your queues</h2>
        <Link href="/dashboard/queues">
          View all
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <QueueSummary queues={queues} staff={membership.role === "staff"} />
      <section className="workspace-tip">
        <span className="tip-symbol">✳</span>
        <div>
          <h2>One small QR. A better waiting experience.</h2>
          <p>Print a queue QR code and place it where customers arrive. Their first scan is all it takes.</p>
        </div>
        <Link href="/dashboard/queues" className="button-secondary">
          Get a queue QR
          <ArrowUpRight size={17} />
        </Link>
      </section>
    </>
  );
}
