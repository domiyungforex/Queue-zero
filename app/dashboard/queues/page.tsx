import { QueueSummary } from "@/components/dashboard/queue-summary";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { requireBusinessMembership } from "@/lib/business/membership";
export default async function QueuesPage() {
  const membership = await requireBusinessMembership();
  const queues = await getDashboardQueues();
  return <><h1 className="text-3xl font-semibold">Queues</h1><p className="mb-8 mt-3 text-muted">{membership.role === "staff" ? "Queues assigned to you." : "Queues across your business locations."}</p><QueueSummary queues={queues} staff={membership.role === "staff"} /></>;
}
