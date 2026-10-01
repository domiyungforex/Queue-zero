"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { QueueAction, QueueState } from "@/lib/validation/queue";

export function QueueStatusControls({ status, action }: { status: "open" | "paused" | "closed"; action: QueueAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as QueueState);
  const router = useRouter();
  return <div className="mt-6">
    <form action={formAction} aria-busy={pending} className="flex flex-wrap gap-3">
      {status !== "open" && <button name="status" value="open" disabled={pending || state.conflict} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-white disabled:opacity-50">{status === "paused" ? "Resume queue" : "Reopen queue"}</button>}
      {status === "open" && <button name="status" value="paused" disabled={pending || state.conflict} className="min-h-12 rounded-xl border border-black/20 px-6 font-semibold disabled:opacity-50">Pause queue</button>}
      {status !== "closed" && <button name="status" value="closed" disabled={pending || state.conflict} className="min-h-12 rounded-xl border border-black/20 px-6 font-semibold disabled:opacity-50">Close queue</button>}
    </form>
    <p className="mt-3 text-sm text-muted">Pausing or closing stops new joins. Existing tickets are kept. You can reopen at any time.</p>
    {pending && <p role="status" className="mt-3 text-sm">Updating queue…</p>}
    {state.status === "error" && <div role="alert" className="mt-4 text-red-800"><p>{state.message}</p>{state.conflict && <button onClick={() => router.refresh()} className="mt-2 min-h-11 rounded-lg border px-4">Reload latest details</button>}</div>}
  </div>;
}
