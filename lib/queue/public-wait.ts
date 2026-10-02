import { formatWaitRange } from "@/lib/wait-time/format";
import type { PublicQueue } from "@/lib/validation/public-queue";

/** Queue-state presentation around the shared human-friendly range formatter. */
export function formatPublicWait(queue: Pick<PublicQueue, "status" | "estimated_wait_seconds" | "has_serving_customer">): string {
  if (queue.status !== "open" || queue.estimated_wait_seconds === null) return "Unavailable while closed to new joins";
  const seconds = queue.estimated_wait_seconds;
  if (seconds === 0) return queue.has_serving_customer ? "After the current customer" : "No wait expected";
  return formatWaitRange(seconds);
}
