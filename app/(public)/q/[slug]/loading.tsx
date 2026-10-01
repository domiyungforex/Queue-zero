import { PublicQueueShell } from "@/components/customer/public-queue-shell";
export default function Loading() {
  return <PublicQueueShell><h1 className="text-2xl font-semibold">Loading queue…</h1><p role="status" className="mt-3 text-muted">Getting the latest queue details.</p><div aria-hidden="true" className="mt-8 h-64 animate-pulse rounded-2xl bg-black/5" /></PublicQueueShell>;
}
