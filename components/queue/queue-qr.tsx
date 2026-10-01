import { publicEnv } from "@/lib/env";
import { generateQueueQr } from "@/lib/queue/qr";
import { QueueQrCard, QueueQrUnavailable } from "@/components/queue/queue-qr-card";

export async function QueueQr({ queueId, slug, businessName, queueName, sheet = false }: {
  queueId: string;
  slug: string;
  businessName: string;
  queueName: string;
  sheet?: boolean;
}) {
  // Handle encoding/configuration failures here; rendering errors use the route boundary.
  const artifact = await generateQueueQr(publicEnv.NEXT_PUBLIC_APP_URL, slug).catch(() => null);
  if (!artifact) return <QueueQrUnavailable />;
  return <QueueQrCard key={artifact.publicUrl} artifact={artifact} queueId={queueId} businessName={businessName} queueName={queueName} sheet={sheet} />;
}
