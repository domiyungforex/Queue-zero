import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import type { PublicQueue } from "@/lib/validation/public-queue";
import { formatPublicWait } from "@/lib/queue/public-wait";
import { PublicQueueShell } from "@/components/customer/public-queue-shell";
import { BusinessLogo } from "@/components/customer/business-logo";
import { RefreshQueue } from "@/components/customer/refresh-queue";

const states = {
  open: { label: "Open", color: "bg-green-100 text-green-900", message: "No download. No account. Keep your place without standing in line.", button: "Join queue" },
  paused: { label: "Paused", color: "bg-amber-100 text-amber-900", message: "New joins are paused. Please check with staff or refresh this page in a moment.", button: "Queue paused" },
  closed: { label: "Closed", color: "bg-neutral-100 text-neutral-700", message: "This queue is closed to new joins. Please check with staff for opening times.", button: "Queue closed" },
} as const;

export function PublicQueueView({ queue }: { queue: PublicQueue }) {
  const state = queue.is_full
    ? { label: "Full", color: "bg-amber-100 text-amber-900", message: "This queue has reached its current capacity. Please check again soon or speak with staff.", button: "Queue full" }
    : states[queue.status];
  return <PublicQueueShell>
    <div className="flex items-center gap-4">
      <BusinessLogo key={queue.business_logo_url ?? queue.business_name} name={queue.business_name} url={queue.business_logo_url} />
      <div className="min-w-0"><p className="break-words text-lg font-semibold">{queue.business_name}</p><p className="mt-1 break-words text-sm text-muted">{queue.location_name}</p></div>
    </div>
    <div className="mt-7"><span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${state.color}`}>{state.label}</span>
      <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight">{queue.queue_name}</h1>
      <p className="mt-2 break-words text-base font-medium text-primary">{queue.service_name}</p>
      {queue.description && <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-muted">{queue.description}</p>}
    </div>
    <section aria-label="Current queue" className="mt-7 rounded-2xl border border-black/10 bg-white p-6">
      <p className="break-all text-5xl font-semibold tracking-tight tabular-nums">{queue.waiting_count.toLocaleString("en")}</p>
      <p className="mt-2 text-muted">{queue.waiting_count === 1 ? "person currently waiting" : "people currently waiting"}</p>
      <div className="mt-6 border-t border-black/10 pt-5">
        <h2 className="text-sm font-medium text-muted">Estimated wait</h2>
        <p className="mt-2 text-2xl font-semibold leading-snug">{queue.status === "open" ? formatPublicWait(queue) : "Not available right now"}</p>
        {queue.status === "open" && <p className="mt-2 text-sm leading-relaxed text-muted">Times are estimates and can change.</p>}
      </div>
    </section>
    {queue.waiting_count === 0 && <p className="mt-4 text-sm text-muted">No one is waiting right now.</p>}
    <div className="mt-6">
      {queue.status === "open" ? <Link prefetch={false} href={`/q/${queue.slug}/join`} aria-describedby="join-availability" className="flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white">Join queue</Link> :
        <button type="button" disabled aria-describedby="join-availability" className="min-h-14 w-full cursor-not-allowed rounded-xl bg-black/10 px-6 py-4 text-lg font-semibold text-muted">{state.button}</button>}
      <p id="join-availability" className="mt-3 text-center text-sm leading-relaxed text-muted">{state.message}</p>
    </div>
    <div className="mt-5"><LiveRefresh topic={`public-queue:${queue.slug}`} /></div>
    <RefreshQueue />
  </PublicQueueShell>;
}
