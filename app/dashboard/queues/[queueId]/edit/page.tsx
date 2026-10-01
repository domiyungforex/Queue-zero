import Link from "next/link";
import { requireBusinessManager } from "@/lib/business/membership";
import { getDashboardLocations } from "@/lib/dashboard/data";
import { getManagedQueue } from "@/lib/queue/management";
import { updateQueue } from "@/app/dashboard/queues/actions";
import { QueueForm } from "@/components/queue/queue-form";

export default async function EditQueuePage({ params }: { params: Promise<{ queueId: string }> }) {
  const membership = await requireBusinessManager();
  const queue = await getManagedQueue((await params).queueId);
  const locations = await getDashboardLocations();
  return <>
    <Link href={`/dashboard/queues/${queue.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">← Queue details</Link>
    <h1 className="mt-3 text-3xl font-semibold">Edit queue</h1>
    <p className="mb-8 mt-3 text-muted">Your public queue link stays the same when you change these settings.</p>
    {!locations.some((location) => location.is_active) && <p role="status" className="mb-6 rounded-xl bg-amber-50 p-4">An active location is needed before you can save changes.</p>}
    <QueueForm key={`${queue.id}:${queue.revision}`} editing locations={locations}
      action={updateQueue.bind(null, { businessId: membership.businessId, queueId: queue.id, revision: queue.revision })}
      initialValues={{ name: queue.name, description: queue.description ?? "", locationId: queue.location_id,
        serviceMinutes: String(queue.average_service_seconds / 60), warningThreshold: String(queue.warning_threshold),
        phoneMode: queue.require_phone ? "required" : queue.allow_phone ? "optional" : "none" }} />
  </>;
}
