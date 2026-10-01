import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicQueue } from "@/lib/queue/public";
import { PublicQueueView } from "@/components/customer/public-queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join a queue", robots: { index: false, follow: false } };

export default async function PublicQueuePage({ params }: { params: Promise<{ slug: string }> }) {
  const queue = await getPublicQueue((await params).slug);
  if (!queue) notFound();
  return <PublicQueueView queue={queue} />;
}
