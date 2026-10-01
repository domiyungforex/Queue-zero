import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTicket } from "@/lib/queue/ticket";
import { PublicTicketView } from "@/components/customer/public-ticket";
import { cancelTicket } from "@/app/(public)/ticket/[token]/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your ticket", referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await getPublicTicket(token);
  if (!ticket) notFound();
  return <PublicTicketView key={`${token}:${ticket.status}`} ticket={ticket} cancelAction={cancelTicket.bind(null, token)} />;
}
