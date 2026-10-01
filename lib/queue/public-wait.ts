import type { PublicQueue } from "@/lib/validation/public-queue";

/** Landing-page presentation only; rolling service averages belong to the queue engine. */
export function formatPublicWait(queue: Pick<PublicQueue, "status" | "estimated_wait_seconds" | "has_serving_customer">): string {
  if (queue.status !== "open" || queue.estimated_wait_seconds === null) return "Unavailable while closed to new joins";
  const seconds = queue.estimated_wait_seconds;
  if (seconds === 0) return queue.has_serving_customer ? "After the current customer" : "No wait expected";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 5) return "Under 5 min";
  if (minutes < 60) {
    const lower = Math.floor(minutes / 5) * 5;
    return `About ${lower}–${lower + 5} min`;
  }
  if (minutes < 1440) {
    const lower = Math.floor(minutes / 60);
    return `About ${lower}–${lower + 1} hr`;
  }
  const lower = Math.floor(minutes / 1440);
  return `About ${lower}–${lower + 1} days`;
}
