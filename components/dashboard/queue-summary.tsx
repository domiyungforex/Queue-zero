import Link from "next/link";
import { formatServiceDuration } from "@/lib/queue/format";
import type { getDashboardQueues } from "@/lib/dashboard/data";

export function QueueSummary({ queues, staff = false }: { queues: Awaited<ReturnType<typeof getDashboardQueues>>; staff?: boolean }) {
  if (!queues.length) return <div className="rounded-2xl border border-dashed border-black/20 bg-white p-8">
    <h2 className="text-xl font-semibold">{staff ? "No queues assigned" : "No queues yet"}</h2>
    <p className="mt-2 max-w-lg leading-relaxed text-muted">{staff ? "Your assigned queues will appear here. Contact your business owner for access." : "Create a queue for each service your customers wait for."}</p>
    {!staff && <Link href="/dashboard/queues/new" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-white">Create your first queue</Link>}
  </div>;
  return <ul className="grid gap-4 xl:grid-cols-2">{queues.map((queue) => <li key={queue.id} className="min-w-0 rounded-2xl border border-black/10 bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-words text-xl font-semibold">{queue.name}</h2>
      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${queue.status === "open" ? "bg-green-100 text-green-900" : queue.status === "paused" ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-700"}`}>{queue.status}</span></div>
    <p className="mt-2 break-words text-sm text-muted">{queue.locations?.name ?? "Location unavailable"}</p>
    {queue.description && <p className="mt-4 break-words text-muted">{queue.description}</p>}
    <p className="mt-5 border-t border-black/10 pt-4 text-sm text-muted">Configured service time: {formatServiceDuration(queue.average_service_seconds)} per customer</p>
    <Link href={`/dashboard/queues/${queue.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">View queue →<span className="sr-only"> {queue.name}</span></Link>
  </li>)}</ul>;
}
