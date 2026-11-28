import { getInstitutionSnapshot } from "@/lib/institution/data";
import { redirect } from "next/navigation";
import Link from "next/link";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getBusinessMetrics } from "@/lib/queue/console";
import { PersonalQueuesMobile } from "@/components/professional/personal-workspace-mobile";
import personalStyles from "@/components/professional/personal-workspace-mobile.module.css";
import { PageHeading } from "@/components/ui/workspace";
import { Plus } from "lucide-react";

type QueueFilter = "all" | "open" | "paused" | "closed";

export default async function QueuesPage({ searchParams }: { searchParams?: Promise<{ status?: string | string[] }> } = {}) {
  const membership = await requireBusinessMembership();
  if(membership.role === "student")redirect("/attend");
  const manager = membership.role === "owner" || membership.role === "admin";
  const institution = membership.institutionType ? await getInstitutionSnapshot() : null;
  const canCreate = manager || institution?.snapshot.units.some(unit => unit.permissions.includes("queue.create"));
  const personalService = membership.workspaceOwnership === "INDIVIDUAL" && Boolean(membership.professionalCategory) && membership.professionalCategory !== "LECTURER_TEACHER";
  const [queuesResult, metricsResult] = await Promise.allSettled([getDashboardQueues(), personalService ? getBusinessMetrics() : Promise.resolve(null)]);
  const queues = queuesResult.status === "fulfilled" ? queuesResult.value : [];
  const metrics = metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const rawStatus = (await searchParams)?.status;
  const requestedStatus = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const activeFilter: QueueFilter = requestedStatus === "open" || requestedStatus === "paused" || requestedStatus === "closed" ? requestedStatus : "all";
  return <>
    {personalService && <PersonalQueuesMobile queues={queues} metrics={metrics} canManage={Boolean(canCreate)} activeFilter={activeFilter} queueError={queuesResult.status === "rejected"} metricError={metricsResult.status === "rejected"} />}
    <div className={personalService ? personalStyles.desktopOnly : undefined}><PageHeading eyebrow="QUEUES" title="Queues" description={!manager ? "Queues assigned to you." : "Queues across your business locations."} action={canCreate ? <Link href="/dashboard/queues/new" className="button-primary"><Plus size={18} />Create queue</Link> : undefined} />{queuesResult.status === "fulfilled" ? <QueueSummary queues={queues} staff={!manager} /> : <div className="notice warning" role="alert">Your queues could not be loaded.</div>}</div>
  </>;
}
