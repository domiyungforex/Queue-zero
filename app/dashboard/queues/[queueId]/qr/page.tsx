import { requireBusinessMembership } from "@/lib/business/membership";
import { getManagedQueue } from "@/lib/queue/management";
import { QueueQr } from "@/components/queue/queue-qr";
import styles from "@/components/queue/queue-qr.module.css";
import { Breadcrumbs } from "@/components/ui/flow";

export default async function QueueQrPage({ params }: { params: Promise<{ queueId: string }> }) {
  const membership = await requireBusinessMembership();
  const queue = await getManagedQueue((await params).queueId);
  return <>
    <div className={`mb-6 ${styles.screenOnly}`}>
      <Breadcrumbs items={[{ label: "Queues", href: "/dashboard/queues" }, { label: queue.name, href: `/dashboard/queues/${queue.id}` }, { label: "QR code" }]} />
      <p className="mt-3 text-sm text-muted">Print this sheet and place it where customers arrive.</p>
    </div>
    <QueueQr queueId={queue.id} slug={queue.slug} businessName={membership.businessName} queueName={queue.name} sheet />
  </>;
}
