import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTicketReceipt } from "@/lib/queue/join";
import { PublicQueueShell } from "@/components/customer/public-queue-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your ticket", referrer: "no-referrer", robots: { index: false, follow: false } };
const labels = { waiting: "You’re in line", serving: "It’s your turn", completed: "Service completed", no_show: "Marked as no-show", cancelled: "Ticket cancelled" };
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const ticket = await getTicketReceipt((await params).token);
  if (!ticket) notFound();
  return <PublicQueueShell><p className="break-words text-muted">{ticket.business_name}</p><h1 className="mt-3 text-3xl font-semibold">{labels[ticket.status]}</h1><div className="mt-7 rounded-2xl border border-black/10 bg-white p-6 text-center"><p className="text-sm text-muted">Your queue number</p><p className="my-5 break-all text-6xl font-bold tabular-nums">{ticket.display_number}</p><p className="break-words text-lg font-medium">{ticket.queue_name}</p></div><p className="mt-6 text-muted">Keep this private link to your ticket. This receipt does not update automatically. Follow staff instructions.</p></PublicQueueShell>;
}
