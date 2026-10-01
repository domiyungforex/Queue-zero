import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { QueueSummary } from "@/components/dashboard/queue-summary";

export default async function Page() {
  const membership = await requireBusinessMembership();
  const queues = await getDashboardQueues();
  return <>
    <p className="text-sm font-medium text-primary">Your workspace</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Overview</h1>
    <p className="mt-3 text-muted">{membership.role === "staff" ? "See the queues assigned to you." : "Keep your business queues in view."}</p>
    {queues.length > 0 && <dl className="my-8 grid grid-cols-2 gap-4">
      {[ ["Accessible queues", queues.length], ["Open queues", queues.filter((queue) => queue.status === "open").length] ].map(([label, value]) => <div key={label} className="rounded-2xl border border-black/10 bg-white p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 text-4xl font-semibold">{value}</dd></div>)}
    </dl>}
    <div className="mb-4 mt-8 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Queues</h2><Link href="/dashboard/queues" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary">View queues →</Link></div>
    <QueueSummary queues={queues} staff={membership.role === "staff"} />
  </>;
}
