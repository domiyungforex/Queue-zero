"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshQueue() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="mt-5 text-center">
    <button type="button" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}
      className="min-h-12 rounded-xl border border-black/20 px-6 py-3 text-sm font-semibold disabled:opacity-50">
      {pending ? "Updating queue…" : "Refresh queue"}
    </button>
    <p role="status" className="sr-only">{pending ? "Loading the latest queue status." : ""}</p>
  </div>;
}
