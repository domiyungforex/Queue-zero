import { getInstitutionSnapshot } from "@/lib/institution/data";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StaffConsole } from "@/components/queue/staff-console";
import { getQueueConsole } from "@/lib/queue/console";
import { Suspense } from "react";
import { QueueQr } from "@/components/queue/queue-qr";
import { formatServiceDuration } from "@/lib/queue/format";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getManagedQueue } from "@/lib/queue/management";

export default async function QueueDetailsPage({ params, searchParams }: {
  params: Promise<{ queueId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const membership = await requireBusinessMembership();
  if(membership.role === "student")redirect("/attend");
  const queue = await getManagedQueue((await params).queueId);
  const consoleState = await getQueueConsole(queue.id);
  const saved = (await searchParams).saved;
  const message = saved === "created" ? "Queue created." : saved === "updated" ? "Queue settings saved." : saved === "status" ? `Queue is now ${queue.status}.` : null;
  const institution = membership.institutionType && queue.unit_id ? await getInstitutionSnapshot(queue.unit_id) : null;
  const manager = Boolean(institution?.snapshot.units.find(unit => unit.id === queue.unit_id)?.permissions.includes("queue.manage")) || membership.role === "owner" || membership.role === "admin";
  return <>
    <Link href="/dashboard/queues" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">← Queues</Link>
    {message && <p role="status" className="my-4 rounded-xl bg-green-50 p-4 text-green-900">{message}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><h1 className="min-w-0 break-words text-3xl font-semibold">{queue.name}</h1>
      {manager && <Link href={`/dashboard/queues/${queue.id}/edit`} className="inline-flex min-h-12 items-center rounded-xl border border-black/20 px-5 font-semibold">Edit settings</Link>}</div>
    <p className="mt-3 break-words text-muted">{queue.locations?.name ?? "Location unavailable"}</p>
    <p className="mt-2 break-words font-medium text-primary">{queue.service_name}</p>
    {queue.description && <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-muted">{queue.description}</p>}
    <StaffConsole initial={consoleState} manager={manager} />
    <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[
      ["Typical service time", formatServiceDuration(queue.average_service_seconds)],
      ["Notification threshold", `${queue.warning_threshold} people ahead`],
      ["Phone number", queue.require_phone ? "Required" : queue.allow_phone ? "Optional" : "Not collected"],
      ["Capacity", queue.capacity == null ? "No custom limit" : String(queue.capacity)],
      ["Operating hours", queue.opens_at && queue.closes_at ? `${queue.opens_at.slice(0,5)}–${queue.closes_at.slice(0,5)}` : "Manual open / close"],
    ].map(([label,value]) => <div key={label} className="rounded-xl border border-black/10 bg-white p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}</dl>
    <Link href={`/display/${queue.slug}`} target="_blank" rel="noopener noreferrer" className="button-secondary mt-6">Open waiting-room display ↗</Link>
    <Suspense fallback={<p role="status" className="mt-8 text-muted">Preparing queue QR code…</p>}>
      <QueueQr queueId={queue.id} slug={queue.slug} businessName={membership.businessName} queueName={queue.name} />
    </Suspense>
  </>;
}
