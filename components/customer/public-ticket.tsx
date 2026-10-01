import Link from "next/link";
import type { CancelTicketAction, PublicTicket } from "@/lib/validation/ticket";
import { formatPublicWait } from "@/lib/queue/public-wait";
import { PublicQueueShell } from "@/components/customer/public-queue-shell";
import { CancelTicket } from "@/components/customer/cancel-ticket";
import { RefreshTicket } from "@/components/customer/refresh-ticket";

const states = {
  waiting: { title: "You’re in line", message: "Your place is saved. Keep this private link to check your ticket.", color: "text-foreground" },
  serving: { title: "It’s your turn", message: "Please proceed to the service area now.", color: "text-primary" },
  completed: { title: "Service completed", message: "You’re all done. Thank you for visiting.", color: "text-primary" },
  no_show: { title: "You were marked as a no-show", message: "Your place is no longer active. Speak to staff if you’re still at the service area.", color: "text-amber-900" },
  cancelled: { title: "You’ve left the queue", message: "Your ticket is cancelled. You can join again when you’re ready.", color: "text-muted" },
} as const;

export function PublicTicketView({ ticket, cancelAction }: { ticket: PublicTicket; cancelAction: CancelTicketAction }) {
  const state = states[ticket.status];
  const waiting = ticket.status === "waiting";
  const active = waiting || ticket.status === "serving";
  const unavailable = ticket.queue_status !== "open" || !ticket.location_active;
  const joined = new Intl.DateTimeFormat("en", { timeZone: ticket.location_timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ticket.joined_at));
  return <PublicQueueShell>
    <p className="break-words text-lg font-semibold">{ticket.business_name}</p><p className="mt-1 break-words text-sm text-muted">{ticket.location_name}</p>
    <h1 className={`mt-7 text-3xl font-semibold tracking-tight ${state.color}`}>{state.title}</h1><p className="mt-3 leading-relaxed text-muted">{state.message}</p>
    <section aria-label="Your ticket" className={`mt-6 rounded-2xl border p-6 text-center ${ticket.status === "serving" ? "border-primary/30 bg-green-50" : "border-black/10 bg-white"}`}>
      <p className="text-sm font-medium text-muted">{ticket.status === "serving" ? "Now serving" : "Your queue number"}</p><p className="my-5 break-all text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">{ticket.display_number}</p>
      <p className="break-words text-lg font-semibold">{ticket.queue_name}</p>
      {waiting && <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/10 pt-5 text-left"><div><p className="text-3xl font-semibold tabular-nums">{ticket.people_ahead?.toLocaleString("en")}</p><p className="mt-1 text-sm text-muted">{ticket.people_ahead === 1 ? "person before you" : "people before you"}</p></div><div><p className="text-sm text-muted">Estimated wait</p><p className="mt-1 text-lg font-semibold">{unavailable ? "Unavailable right now" : formatPublicWait({ status: ticket.queue_status, estimated_wait_seconds: ticket.estimated_wait_seconds, has_serving_customer: ticket.has_serving_customer })}</p></div></div>}
    </section>
    {waiting && !unavailable && <p className="mt-4 text-sm leading-relaxed text-muted">{ticket.people_ahead === 0 ? "You’re next in the waiting line. Wait for staff to call your number." : "Times are estimates and may change. Follow staff instructions when returning."}</p>}
    {active && unavailable && <div role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-950"><p className="font-semibold">{!ticket.location_active ? "Location unavailable" : ticket.queue_status === "paused" ? "Queue paused" : "Queue closed to new joins"}</p><p className="mt-1 text-sm">Your ticket is still recorded. Please check with staff for service updates.</p></div>}
    <p className="mt-5 text-sm text-muted">Joined <time dateTime={ticket.joined_at}>{joined}</time></p>
    {active && <RefreshTicket />}
    {waiting && <div className="mt-6"><CancelTicket action={cancelAction} /></div>}
    {!active && <Link prefetch={false} href={`/q/${ticket.queue_slug}`} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-white">View queue</Link>}
    <p className="mt-6 text-center text-xs leading-relaxed text-muted">Keep this link private. Anyone with it can view your ticket and leave the queue while you’re waiting.</p>
  </PublicQueueShell>;
}
