import { notFound } from "next/navigation";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireBusinessManager, requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardLocations } from "@/lib/dashboard/data";
import { createQueue } from "@/app/dashboard/queues/actions";
import { QueueForm } from "@/components/queue/queue-form";
import { ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";

export default async function NewQueuePage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const current = await requireBusinessMembership();
  const membership = current.institutionType ? current : await requireBusinessManager();
  const institution = membership.institutionType ? await getInstitutionSnapshot() : null;
  const units = institution?.snapshot.units.filter(unit => unit.status === "active" && (institution.manager || unit.permissions.includes("queue.create")));
  if (units && !units.length) notFound();
  const selectedUnitId = (await searchParams).unit;
  const locations = await getDashboardLocations();
  const queueId = randomUUID();
  return <>
    <Breadcrumbs items={[{ label: "Queues", href: "/dashboard/queues" }, { label: "Create a queue" }]} />
    <PageHeading eyebrow="QUEUES" title="Create a queue" description="Choose the service your customers are waiting for." />
    {locations.some((location) => location.is_active)
      ? <QueueForm action={createQueue.bind(null, { businessId: membership.businessId, queueId })} locations={locations} units={units} selectedUnitId={selectedUnitId} />
      : <div className="panel p-8"><h2 className="text-xl font-semibold">An active location is needed</h2><p className="mt-3 text-muted">This business has no active locations for a new queue.</p><Link href="/dashboard/locations" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary">View locations <ArrowRight size={18} aria-hidden="true" /></Link></div>}
  </>;
}
