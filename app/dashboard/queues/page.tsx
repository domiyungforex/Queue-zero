import Link from "next/link";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { requireBusinessMembership } from "@/lib/business/membership";
export default async function QueuesPage() {
  const membership = await requireBusinessMembership();
  const queues = await getDashboardQueues();
  return <><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Queues</h1>{membership.role !== "staff" && <Link href="/dashboard/queues/new" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-semibold text-white">Create queue</Link>}</div><p className="mb-8 mt-3 text-muted">{membership.role === "staff" ? "Queues assigned to you." : "Queues across your business locations."}</p><QueueSummary queues={queues} staff={membership.role === "staff"} /></>;
}
