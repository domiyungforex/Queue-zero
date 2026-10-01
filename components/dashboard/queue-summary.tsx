import type { getDashboardQueues } from "@/lib/dashboard/data";

export function QueueSummary({ queues, staff = false }: { queues: Awaited<ReturnType<typeof getDashboardQueues>>; staff?: boolean }) {
  if (!queues.length) return <div className="rounded-2xl border border-dashed border-black/20 bg-white p-8">
    <h2 className="text-xl font-semibold">{staff ? "No queues assigned" : "No queues yet"}</h2>
    <p className="mt-2 max-w-lg leading-relaxed text-muted">{staff ? "Your assigned queues will appear here. Contact your business owner for access." : "Your queues will appear here, with their location and current status."}</p>
  </div>;
  return <ul className="grid gap-4 xl:grid-cols-2">{queues.map((queue) => <li key={queue.id} className="min-w-0 rounded-2xl border border-black/10 bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-words text-xl font-semibold">{queue.name}</h2>
      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${queue.status === "open" ? "bg-green-100 text-green-900" : queue.status === "paused" ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-700"}`}>{queue.status}</span></div>
    <p className="mt-2 break-words text-sm text-muted">{queue.locations?.name ?? "Location unavailable"}</p>
    {queue.description && <p className="mt-4 break-words text-muted">{queue.description}</p>}
    <p className="mt-5 border-t border-black/10 pt-4 text-sm text-muted">Configured service time: {Math.max(1, Math.round(queue.average_service_seconds / 60))} min per customer</p>
  </li>)}</ul>;
}
