import Link from "next/link";
import { ArrowUpRight, CheckCheck, Clock3, MapPin, Plus, UserRound, Users } from "lucide-react";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { PageHeading, StatCard, duration } from "@/components/ui/workspace";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { getProfessionalWorkspaceProfile } from "@/lib/professional/data";
import { PROFESSIONAL_DASHBOARD_COPY, PROFESSIONAL_LABELS, type ProfessionalCategory } from "@/lib/professional/contracts";
import { getBusinessMetrics } from "@/lib/queue/console";

type ServiceProfession = Exclude<ProfessionalCategory, "LECTURER_TEACHER">;

export async function ProfessionalOverview({ category, canManage }: {
  category: ServiceProfession;
  canManage: boolean;
}) {
  const [profile, queues, metrics] = await Promise.all([
    getProfessionalWorkspaceProfile(),
    getDashboardQueues(),
    getBusinessMetrics(),
  ]);
  const copy = PROFESSIONAL_DASHBOARD_COPY[category];
  const location = profile?.locations;

  return <>
    <PageHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} action={canManage && <Link className="button-primary" href="/dashboard/queues/new"><Plus size={18} />Create queue</Link>} />
    <div className="overview-banner"><div><span className="status-dot" /><strong>{queues.filter(queue => queue.status === "open").length} open {queues.filter(queue => queue.status === "open").length === 1 ? "queue" : "queues"}</strong><span>{profile?.service_name ?? "Your service"} is ready for real customer arrivals.</span></div></div>
    <div className="metrics-grid">
      <StatCard label="Waiting now" value={metrics.waiting} icon={<Users size={20} />} note="Across your accessible queues" />
      <StatCard label="Serving now" value={metrics.serving} icon={<UserRound size={20} />} note="Current live service" />
      <StatCard label="Served today" value={metrics.completed_today} icon={<CheckCheck size={20} />} note="Completed customer visits" />
      <StatCard label="Average wait" value={duration(metrics.average_wait_seconds)} icon={<Clock3 size={20} />} note="Last 7 days · until called" />
    </div>
    <section className="workspace-tip">
      <MapPin className="tip-symbol" aria-hidden="true" />
      <div><h2>{profile?.service_name ?? PROFESSIONAL_LABELS[category]}</h2><p>{location ? `${location.name} · ${location.address}` : "Your authorized service location."}</p></div>
      <Link href="/dashboard/locations" className="button-secondary">View location<ArrowUpRight size={17} /></Link>
    </section>
    <div className="section-toolbar"><h2>Your queues</h2><Link href="/dashboard/queues">View all<ArrowUpRight size={16} /></Link></div>
    <QueueSummary queues={queues} staff={!canManage} />
    {!queues.length && <p className="mt-4 text-sm text-muted">Your first action is to create a {copy.queueLabel}. TuRnMaRk will use the service location saved during setup.</p>}
  </>;
}
