import { notFound } from "next/navigation";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { requireBusinessManager, requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardLocations } from "@/lib/dashboard/data";
import { getManagedQueue } from "@/lib/queue/management";
import { updateQueue } from "@/app/dashboard/queues/actions";
import { QueueForm } from "@/components/queue/queue-form";
import { PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";

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
    <Breadcrumbs items={[{ label: "Queues", href: "/dashboard/queues" }, { label: queue.name, href: `/dashboard/queues/${queue.id}` }, { label: "Edit queue" }]} />
    <PageHeading eyebrow="QUEUES" title="Edit queue" description="Your public queue link stays the same when you change these settings." />
    {!locations.some((location) => location.is_active) && <p role="status" className="notice warning">An active location is needed before you can save changes.</p>}
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
