"use client";

import { useActionState, useState } from "react";
import type { CancelTicketAction, CancelTicketState } from "@/lib/validation/ticket";

const initial: CancelTicketState = { status: "idle" };
export function CancelTicket({ action }: { action: CancelTicketAction }) {
  const [confirming, setConfirming] = useState(false);
  const [state, submit, pending] = useActionState(action, initial);
  if (!confirming) return <button type="button" onClick={() => setConfirming(true)} className="min-h-12 w-full rounded-xl border border-black/20 px-5 py-3 font-medium">Leave queue</button>;
  return <form action={submit} aria-busy={pending} className="rounded-xl border border-red-200 bg-white p-5">
    <h2 className="text-lg font-semibold">Leave this queue?</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted">You’ll lose your current place. If you join again, you’ll go to the back of the queue.</p>
    <input type="hidden" name="confirm" value="yes" />
    {state.message && <p role="alert" className="mt-4 text-sm text-red-800">{state.message}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-red-800 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Leaving…" : "Yes, leave queue"}</button><button type="button" disabled={pending} onClick={() => setConfirming(false)} className="min-h-12 rounded-lg border border-black/20 px-4 py-3 font-medium disabled:opacity-60">Keep my place</button></div>
  </form>;
}
