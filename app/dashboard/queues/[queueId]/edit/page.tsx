import { notFound } from "next/navigation";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import Link from "next/link";
import { requireBusinessManager, requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardLocations } from "@/lib/dashboard/data";
import { getManagedQueue } from "@/lib/queue/management";
import { updateQueue } from "@/app/dashboard/queues/actions";
import { QueueForm } from "@/components/queue/queue-form";
import { ArrowLeft } from "lucide-react";

export default async function EditQueuePage({ params }: { params: Promise<{ queueId: string }> }) {
  const current = await requireBusinessMembership();
  const membership = current.institutionType ? current : await requireBusinessManager();
  const queue = await getManagedQueue((await params).queueId);
  if (membership.institutionType && queue.unit_id) {
    const { snapshot, manager } = await getInstitutionSnapshot(queue.unit_id);
    if (!manager && !snapshot.units.find(unit => unit.id === queue.unit_id)?.permissions.includes("queue.manage")) notFound();
  }
  const locations = await getDashboardLocations();
  return <>
    <Link href={`/dashboard/queues/${queue.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={18} aria-hidden="true" />Queue details</Link>
    <h1 className="mt-3 text-3xl font-semibold">Edit queue</h1>
    <p className="mb-8 mt-3 text-muted">Your public queue link stays the same when you change these settings.</p>
    {!locations.some((location) => location.is_active) && <p role="status" className="mb-6 rounded-xl bg-amber-50 p-4">An active location is needed before you can save changes.</p>}
    <QueueForm key={`${queue.id}:${queue.revision}`} editing locations={locations}
      action={updateQueue.bind(null, { businessId: membership.businessId, queueId: queue.id, revision: queue.revision })}
      initialValues={{
        name: queue.name,
        serviceName: queue.service_name,
        description: queue.description ?? "",
        locationId: queue.location_id,
        serviceMinutes: String(queue.average_service_seconds / 60),
        capacity: queue.capacity == null ? "" : String(queue.capacity),
        opensAt: queue.opens_at ?? "",
        closesAt: queue.closes_at ?? "",
        status: queue.status,
        warningThreshold: String(queue.warning_threshold),
        phoneMode: queue.require_phone ? "required" : queue.allow_phone ? "optional" : "none",
      }} />
  </>;
}
