import { describe, expect, it } from "vitest";
import { calculatePeopleAhead, calculateServiceAverage, estimateWaitSeconds, measureServiceDuration, type QueuePosition } from "@/lib/wait-time/engine";
import { formatWaitRange } from "@/lib/wait-time/format";

const id = (number: number) => `a0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
function sample(number: number, seconds: number) {
  const completed = Date.UTC(2026, 9, 2, 12, number);
  return { id: id(number), calledAt: new Date(completed - seconds * 1000).toISOString(), completedAt: new Date(completed).toISOString() };
}
describe("service duration", () => {
  it("measures service rather than time spent waiting", () => {
    expect(measureServiceDuration("2026-10-02T10:00:00Z", "2026-10-02T10:05:00Z")).toBe(300);
    expect(measureServiceDuration("2026-10-02T11:00:00+01:00", "2026-10-02T10:05:00Z")).toBe(300);
  });
  it("retains PostgreSQL microsecond precision", () => {
    expect(measureServiceDuration("2026-10-02T10:00:00.000001Z", "2026-10-02T10:00:01.000002Z")).toBe(1.000001);
  });
  it.each([[null, null], ["invalid", "2026-10-02T10:00:00Z"], ["2026-10-02T10:00:00Z", null], ["2026-10-02T10:00:00Z", "2026-10-02T10:00:00Z"], ["2026-10-02T10:01:00Z", "2026-10-02T10:00:00Z"]])("ignores invalid/incomplete/nonpositive duration %s → %s", (called, completed) => {
    expect(measureServiceDuration(called, completed)).toBeNull();
  });
  it("bounds accidental overnight durations and subsecond completions", () => {
    expect(measureServiceDuration("2026-09-01T00:00:00Z", "2026-10-02T00:00:00Z")).toBe(86400);
    expect(measureServiceDuration("2026-10-02T00:00:00Z", "2026-10-02T00:00:00.001Z")).toBe(1);
  });
});
describe("bounded historical average", () => {
  it("uses configured defaults for a new queue and fewer than five valid services", () => {
    expect(calculateServiceAverage(300, [])).toEqual({ sampleCount: 0, recentAverageSeconds: null, averageServiceSeconds: 300, source: "configured" });
    expect(calculateServiceAverage(300, [sample(1, 600), sample(2, 600), sample(3, 600), sample(4, 600), { ...sample(5, 600), calledAt: null }])).toEqual({ sampleCount: 4, recentAverageSeconds: 600, averageServiceSeconds: 300, source: "configured" });
  });
  it("calculates a recent mean and 0.25 exponential smoothing independently", () => {
    const samples = [1, 2, 3, 4, 5].map((n) => sample(n, 600));
    expect(calculateServiceAverage(300, samples)).toEqual({ sampleCount: 5, recentAverageSeconds: 600, averageServiceSeconds: 529, source: "history" });
    expect(calculateServiceAverage(300, [...samples].reverse())).toEqual(calculateServiceAverage(300, samples));
  });
  it("keeps only the latest twenty samples and does not let old outliers dominate", () => {
    const samples = [sample(0, 86400), ...Array.from({ length: 20 }, (_, i) => sample(i + 1, 60))];
    expect(calculateServiceAverage(300, samples)).toEqual({ sampleCount: 20, recentAverageSeconds: 60, averageServiceSeconds: 61, source: "history" });
  });
  it("uses completion order, including deterministic UUID ties", () => {
    const samples = [1, 2, 3, 4, 5].map((n) => ({ ...sample(n, n * 60), completedAt: "2026-10-02T13:00:00Z", calledAt: new Date(Date.UTC(2026, 9, 2, 13) - n * 60_000).toISOString() }));
    expect(calculateServiceAverage(300, samples.reverse()).averageServiceSeconds).toBe(234);
  });
  it("orders completed samples by microseconds before their IDs", () => {
    const samples = [1, 2, 3, 4, 5].map((n) => ({ id: id(n),
      completedAt: `2026-10-02T13:00:00.00000${6 - n}Z`,
      calledAt: `2026-10-02T12:${60 - n}:00.00000${6 - n}Z`,
    }));
    expect(calculateServiceAverage(300, samples).averageServiceSeconds).toBe(184);
  });
  it("rejects duplicate measurements and invalid defaults", () => {
    expect(() => calculateServiceAverage(0, [])).toThrow();
    expect(() => calculateServiceAverage(NaN, [])).toThrow();
    expect(() => calculateServiceAverage(300, [sample(1, 60), sample(1, 60)])).toThrow(/Duplicate/);
  });
});
describe("position and serving capacity", () => {
  const target: QueuePosition = { id: id(3), queueId: id(50), joinedAt: "2026-10-02T00:01:00Z", status: "waiting" };
  it("counts only earlier waiting tickets from the same queue, spanning midnight", () => {
    const earlier = { ...target, id: id(1), joinedAt: "2026-10-01T23:59:00Z" };
    expect(calculatePeopleAhead(target, [earlier, earlier, target, { ...earlier, id: id(2), status: "serving" }, { ...earlier, id: id(4), queueId: id(51) }, { ...target, id: id(5), joinedAt: "2026-10-02T00:02:00Z" }])).toBe(1);
  });
  it("handles empty/terminal queues and microsecond ordering before UUID tie breaks", () => {
    expect(calculatePeopleAhead(target, [])).toBe(0);
    expect(calculatePeopleAhead({ ...target, queueId: target.queueId.toUpperCase() }, [{ ...target, id: id(2) }])).toBe(1);
    expect(calculatePeopleAhead({ ...target, status: "completed" }, [])).toBeNull();
    expect(calculatePeopleAhead({ ...target, joinedAt: "2026-10-02T00:01:00.000002Z" }, [{ ...target, id: id(99), joinedAt: "2026-10-02T00:01:00.000001Z" }])).toBe(1);
    expect(calculatePeopleAhead(target, [{ ...target, id: id(2) }, { ...target, id: id(4) }])).toBe(1);
  });
  it("defaults to one counter, supports explicit capacity and does not invent active counters", () => {
    expect(estimateWaitSeconds(4, 300)).toBe(1200);
    expect(estimateWaitSeconds(4, 300, 2)).toBe(600);
    expect(estimateWaitSeconds(1, 301, 2)).toBe(151);
    expect(estimateWaitSeconds(0, 300)).toBe(0);
    expect(estimateWaitSeconds(4, 300, 0)).toBeNull();
    expect(estimateWaitSeconds(1000, 86400)).toBe(86400000);
    expect(() => estimateWaitSeconds(-1, 300)).toThrow();
    expect(() => estimateWaitSeconds(1, 300, -1)).toThrow();
    expect(() => estimateWaitSeconds(Number.MAX_SAFE_INTEGER, 86400)).toThrow();
  });
});
describe("human-friendly wait ranges", () => {
  it.each([[0, "No wait expected"], [60, "Under 5 min"], [300, "About 5–10 min"], [1062, "About 15–20 min"], [3600, "About 1–2 hr"], [86400, "About 1–2 days"]])("formats %s seconds without a precise countdown", (seconds, expected) => {
    expect(formatWaitRange(seconds as number)).toBe(expected);
  });
  it.each([-1, NaN, Infinity])("rejects invalid estimate %s", (seconds) => expect(() => formatWaitRange(seconds)).toThrow());
});
