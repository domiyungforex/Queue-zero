import { PublicQueueShell } from "@/components/customer/public-queue-shell";
export default function TicketNotFound() {
  return <PublicQueueShell><h1 className="text-3xl font-semibold">Ticket unavailable</h1><p className="mt-4 leading-relaxed text-muted">This ticket link may be incorrect. Reopen the private link you received after joining, or ask staff for help.</p></PublicQueueShell>;
}
