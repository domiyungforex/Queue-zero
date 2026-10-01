import Link from "next/link";
import { Suspense } from "react";
import { QueueQr } from "@/components/queue/queue-qr";
import { formatServiceDuration } from "@/lib/queue/format";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getManagedQueue } from "@/lib/queue/management";
import { changeQueueStatus } from "@/app/dashboard/queues/actions";
import { QueueStatusControls } from "@/components/queue/queue-status-controls";

export default async function QueueDetailsPage({ params, searchParams }: {
  params: Promise<{ queueId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const membership = await requireBusinessMembership();
  const queue = await getManagedQueue((await params).queueId);
  const saved = (await searchParams).saved;
  const message = saved === "created" ? "Queue created." : saved === "updated" ? "Queue settings saved." : saved === "status" ? `Queue is now ${queue.status}.` : null;
  const manager = membership.role !== "staff";
  return <>
    <Link href="/dashboard/queues" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">← Queues</Link>
    {message && <p role="status" className="my-4 rounded-xl bg-green-50 p-4 text-green-900">{message}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><h1 className="min-w-0 break-words text-3xl font-semibold">{queue.name}</h1>
      {manager && <Link href={`/dashboard/queues/${queue.id}/edit`} className="inline-flex min-h-12 items-center rounded-xl border border-black/20 px-5 font-semibold">Edit settings</Link>}</div>
    <p className="mt-3 break-words text-muted">{queue.locations?.name ?? "Location unavailable"}</p>
    {queue.description && <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-muted">{queue.description}</p>}
    <section aria-label="Queue status" className="mt-8 rounded-2xl border border-black/10 bg-white p-6 sm:p-8">
      <p className="text-sm text-muted">Queue status</p><p className="mt-2 text-2xl font-semibold capitalize">{queue.status}</p>
      {manager && <QueueStatusControls key={`${queue.id}:${queue.revision}`} status={queue.status} action={changeQueueStatus.bind(null, { businessId: membership.businessId, queueId: queue.id, revision: queue.revision })} />}
    </section>
    <dl className="mt-6 grid gap-4 sm:grid-cols-3">{[
      ["Typical service time", formatServiceDuration(queue.average_service_seconds)],
      ["Notification threshold", `${queue.warning_threshold} people ahead`],
      ["Phone number", queue.require_phone ? "Required" : queue.allow_phone ? "Optional" : "Not collected"],
    ].map(([label,value]) => <div key={label} className="rounded-xl border border-black/10 bg-white p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}</dl>
    <Suspense fallback={<p role="status" className="mt-8 text-muted">Preparing queue QR code…</p>}>
      <QueueQr queueId={queue.id} slug={queue.slug} businessName={membership.businessName} queueName={queue.name} />
    </Suspense>
  </>;
}
