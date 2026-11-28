import Link from "next/link";
import { ArrowUpRight, CalendarCheck, CheckCheck, ClipboardCheck, Clock3, GraduationCap, Layers, Plus, UserRound, Users } from "lucide-react";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { InstitutionOverview } from "@/components/institution/overview";
import { OrganizationSetupStatus } from "@/components/organization/setup-status";
import { ProfessionalOverview } from "@/components/professional/overview";
import { SchoolOverview } from "@/components/school/overview";
import { FeedbackNotice } from "@/components/school/feedback-notice";
import { DashboardWelcomeBanner } from "@/components/ui/turnmark-system";
import { EmptyState, PageHeading, StatCard, duration } from "@/components/ui/workspace";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { getOrganizationWorkspaceProfile } from "@/lib/organization/data";
import { getBusinessMetrics } from "@/lib/queue/console";

type DashboardPageProps = { searchParams?: Promise<{ onboarding?: string | string[] }> };

export default async function Page({ searchParams }: DashboardPageProps = {}) {
  const membership = await requireBusinessMembership();
  const query = await searchParams;
  const onboardingComplete = query?.onboarding === "complete" && Boolean(membership.onboardingCompletedAt);
  const success = onboardingComplete ? <FeedbackNotice ok={true} message="Your workspace is ready. All permissions and tools have been configured." style={{ marginBottom: "20px" }} /> : null;
  const organizationProfile = membership.workspaceOwnership === "ORGANIZATION" ? await getOrganizationWorkspaceProfile() : null;
  const organizationStatus = organizationProfile ? <OrganizationSetupStatus profile={organizationProfile} /> : null;

  if (membership.role === "student") return <>{success}<PageHeading eyebrow="YOUR WORKSPACE" title={membership.businessName} description="Use the workspace switcher above to move between organizations you belong to." /></>;
  const educationWorkspace = membership.organizationMode === "SCHOOL" || membership.organizationMode === "HYBRID" || membership.organizationType === "UNIVERSITY_SCHOOL";
  if (educationWorkspace && membership.role !== "staff") return <>{success}{organizationStatus}<SchoolOverview individual={membership.workspaceOwnership === "INDIVIDUAL"} /></>;
  if (membership.institutionType) return <>{success}{organizationStatus}<InstitutionOverview /></>;
  if (membership.workspaceOwnership === "INDIVIDUAL" && membership.professionalCategory && membership.professionalCategory !== "LECTURER_TEACHER") return <>{success}<ProfessionalOverview category={membership.professionalCategory} canManage={membership.role === "owner" || membership.role === "admin"} /></>;

  const [queuesResult, metricsResult] = await Promise.all([
    getDashboardQueues().then((queues) => ({ queues, failed: false as const })).catch((error) => {
      console.error("Dashboard queues failed", error);
      return { queues: [], failed: true as const };
    }),
    getBusinessMetrics().then((metrics) => ({ metrics, failed: false as const })).catch((error) => {
      console.error("Dashboard metrics failed", error);
      return { metrics: null, failed: true as const };
    }),
  ]);
  const queues = queuesResult.queues;
  const metrics = metricsResult.metrics;
  const openQueues = queues.filter((queue) => queue.status === "open").length;

  return <>
    {success}
    {organizationStatus}
    <PageHeading eyebrow="LET’S MAKE TODAY FLOW" title="Your day, at a glance." description="A little less queue chaos. A little more personal service." action={(membership.role === "owner" || membership.role === "admin") && <Link className="button-primary" href="/dashboard/queues/new"><Plus size={18} />Create queue</Link>} />
    <DashboardWelcomeBanner eyebrow={`${openQueues} OPEN ${openQueues === 1 ? "QUEUE" : "QUEUES"}`} title="People arrive. Your team keeps moving." description="The illustration supports the workspace while every number below stays connected to actual queue activity." character="businessProfessional" />
    {metrics ? <div className="metrics-grid">
      <StatCard label="Waiting now" value={metrics.waiting} icon={<Users size={20} />} note="Across your accessible queues" />
      <StatCard label="Serving now" value={metrics.serving} icon={<UserRound size={20} />} note="One person at a time" />
      <StatCard label="Served today" value={metrics.completed_today} icon={<CheckCheck size={20} />} note="Completed customer visits" />
      <StatCard label="Average wait" value={duration(metrics.average_wait_seconds)} icon={<Clock3 size={20} />} note="Last 7 days · until called" />
    </div> : <section className="workspace-tip" role="alert"><div><h2>Live totals could not be loaded</h2><p>Queues below are still your real queues. Refresh to try the totals again. No sample numbers are shown.</p></div></section>}
    <div className="section-toolbar"><h2>Jump back in</h2></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { href: "/dashboard/queues", icon: <Layers size={23} />, title: "Queues", description: "Open a console, call next, and keep the line moving." },
        { href: "/dashboard/bookings", icon: <CalendarCheck size={23} />, title: "Bookings", description: "See today’s advance bookings and scheduled arrivals." },
        { href: "/dashboard/academic", icon: <GraduationCap size={23} />, title: "Academic", description: "Classes, courses and assignments for your school." },
        { href: "/dashboard/attendance", icon: <ClipboardCheck size={23} />, title: "Attendance", description: "Open registers and check students in." },
      ].map((card) => (
        <Link key={card.href} href={card.href} className="panel queue-card">
          <div className="queue-card-top"><span className="tile-icon">{card.icon}</span><ArrowUpRight size={17} /></div>
          <h2>{card.title}</h2>
          <p>{card.description}</p>
        </Link>
      ))}
    </div>
    <div className="section-toolbar"><h2>Your queues</h2><Link href="/dashboard/queues">View all<ArrowUpRight size={16} /></Link></div>
    {queuesResult.failed ? (
      <section className="workspace-tip" role="alert"><div><h2>Queues could not be loaded</h2><p>Refresh to try again. This is not an empty workspace, and no sample queues are shown.</p></div></section>
    ) : queues.length === 0 ? (
      <EmptyState title="No queues yet" description="Create your first queue to start managing arrivals." href="/dashboard/queues/new" label="Create a queue" />
    ) : (
      <QueueSummary queues={queues} staff={membership.role === "staff"} />
    )}
    <section className="workspace-tip"><span className="tip-symbol">✳</span><div><h2>One small QR. A better waiting experience.</h2><p>Print a queue QR code and place it where customers arrive. Their first scan is all it takes.</p></div><Link href="/dashboard/queues" className="button-secondary">Get a queue QR<ArrowUpRight size={17} /></Link></section>
  </>;
}
