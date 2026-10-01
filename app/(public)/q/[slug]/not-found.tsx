import { PublicQueueShell } from "@/components/customer/public-queue-shell";
export default function PublicQueueNotFound() {
  return <PublicQueueShell><h1 className="text-3xl font-semibold">Queue unavailable</h1><p className="mt-4 leading-relaxed text-muted">This link may be incorrect, or this location may no longer be active. Please ask staff for the current queue QR code.</p></PublicQueueShell>;
}
