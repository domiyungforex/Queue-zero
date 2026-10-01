"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshTicket() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="mt-6 text-center"><button type="button" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())} className="min-h-12 rounded-xl border border-black/20 px-6 py-3 font-semibold disabled:opacity-60">{pending ? "Updating ticket…" : "Refresh ticket"}</button><p className="mt-2 text-sm text-muted">Refresh to check your current place.</p><p role="status" className="sr-only">{pending ? "Getting the latest ticket status." : ""}</p></div>;
}
