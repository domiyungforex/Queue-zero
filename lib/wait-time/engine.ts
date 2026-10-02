import { z } from "zod";
import type { Database } from "@/lib/db/database.types";

export const HISTORY_WINDOW = 20;
export const MINIMUM_SAMPLES = 5;
export const SMOOTHING_WEIGHT = 0.25;
export const MAX_SERVICE_SECONDS = 86_400;
const configuredDuration = z.number().int().min(1).max(MAX_SERVICE_SECONDS);
const timestamp = z.iso.datetime({ offset: true }).refine((value) => (value.match(/\.(\d+)/)?.[1].length ?? 0) <= 6);

// PostgreSQL timestamps carry microseconds; Date alone would collapse their
// ordering to milliseconds and could reorder people or completed samples.
function instantMicros(value: string): bigint {
  const parsed = timestamp.parse(value);
  const fraction = parsed.match(/\.(\d+)/)?.[1] ?? "";
  return BigInt(Date.parse(parsed)) * BigInt(1000) + BigInt(fraction.padEnd(6, "0").slice(3, 6));
}
const counterCount = z.number().int().min(0).max(100);

export type CompletedService = { id: string; calledAt: string | null; completedAt: string | null };
export type QueuePosition = {
  id: string;
  queueId: string;
  joinedAt: string;
  status: Database["public"]["Enums"]["ticket_status"];
};

/** Invalid/missing/zero durations are not evidence. Long durations are bounded. */
export function measureServiceDuration(calledAt: string | null, completedAt: string | null): number | null {
  if (!timestamp.safeParse(calledAt).success || !timestamp.safeParse(completedAt).success) return null;
  const seconds = Number(instantMicros(completedAt!) - instantMicros(calledAt!)) / 1_000_000;
  return seconds > 0 ? Math.min(MAX_SERVICE_SECONDS, Math.max(1, seconds)) : null;
}

/** Recompute a bounded window in completion order; never mutate configured defaults. */
export function calculateServiceAverage(configuredSeconds: number, completed: readonly CompletedService[]) {
  configuredDuration.parse(configuredSeconds);
  const samples = completed.flatMap((sample) => {
    const duration = measureServiceDuration(sample.calledAt, sample.completedAt);
    return duration === null ? [] : [{ id: z.uuid().parse(sample.id).toLowerCase(), time: instantMicros(sample.completedAt!), duration }];
  }).sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, HISTORY_WINDOW).reverse();
  if (new Set(samples.map((sample) => sample.id)).size !== samples.length) throw new Error("Duplicate completed service IDs.");
  const recentAverageSeconds = samples.length ? samples.reduce((sum, sample) => sum + sample.duration, 0) / samples.length : null;
  const average = samples.length < MINIMUM_SAMPLES ? configuredSeconds : samples.reduce(
    (oldAverage, sample) => SMOOTHING_WEIGHT * sample.duration + (1 - SMOOTHING_WEIGHT) * oldAverage,
    configuredSeconds,
  );
  return { sampleCount: samples.length, recentAverageSeconds, averageServiceSeconds: Math.ceil(average), source: samples.length < MINIMUM_SAMPLES ? "configured" as const : "history" as const };
}

/** Existing queue ordering spans local-date number resets: joined_at, then UUID. */
export function calculatePeopleAhead(target: QueuePosition, tickets: readonly QueuePosition[]): number | null {
  if (target.status !== "waiting") return null;
  const targetQueue = z.uuid().parse(target.queueId).toLowerCase();
  const targetTime = instantMicros(target.joinedAt);
  const targetId = z.uuid().parse(target.id).toLowerCase();
  const ids = new Set<string>();
  for (const ticket of tickets) {
    if (ticket.status !== "waiting" || z.uuid().parse(ticket.queueId).toLowerCase() !== targetQueue) continue;
    const id = z.uuid().parse(ticket.id).toLowerCase();
    if (id === targetId) continue;
    const time = instantMicros(ticket.joinedAt);
    if (time < targetTime || (time === targetTime && id < targetId)) ids.add(id);
  }
  return ids.size;
}

/** Zero counters means unavailable. Multiple counters must be explicitly supplied. */
export function estimateWaitSeconds(peopleAhead: number, averageServiceSeconds: number, activeServingCapacity = 1): number | null {
  z.number().int().nonnegative().safe().parse(peopleAhead);
  z.number().min(1).max(MAX_SERVICE_SECONDS).parse(averageServiceSeconds);
  counterCount.parse(activeServingCapacity);
  if (activeServingCapacity === 0) return null;
  const estimate = Math.ceil(peopleAhead * averageServiceSeconds / activeServingCapacity);
  if (!Number.isSafeInteger(estimate)) throw new RangeError("Wait estimate exceeds safe numeric precision.");
  return estimate;
}
