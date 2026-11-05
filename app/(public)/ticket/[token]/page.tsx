import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTicket } from "@/lib/queue/ticket";
import { LiveTicket } from "@/components/customer/live-ticket";
import { cancelTicket } from "@/app/(public)/ticket/[token]/actions";
import { TicketViewedAnalytics } from "@/components/analytics/ticket-viewed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your ticket", referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await getPublicTicket(token);
  if (!ticket) notFound();
  return <><TicketViewedAnalytics /><LiveTicket key={`${token}:${ticket.status}`} token={token} initial={ticket} cancelAction={cancelTicket.bind(null, token)} /></>;
}
