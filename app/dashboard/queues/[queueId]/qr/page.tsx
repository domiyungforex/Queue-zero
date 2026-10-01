import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getManagedQueue } from "@/lib/queue/management";
import { QueueQr } from "@/components/queue/queue-qr";
import styles from "@/components/queue/queue-qr.module.css";

export default async function QueueQrPage({ params }: { params: Promise<{ queueId: string }> }) {
  const membership = await requireBusinessMembership();
  const queue = await getManagedQueue((await params).queueId);
  return <>
    <div className={`mb-6 ${styles.screenOnly}`}>
      <Link href={`/dashboard/queues/${queue.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">← Queue details</Link>
      <p className="mt-3 text-sm text-muted">Print this sheet and place it where customers arrive.</p>
    </div>
    <QueueQr queueId={queue.id} slug={queue.slug} businessName={membership.businessName} queueName={queue.name} sheet />
  </>;
}
