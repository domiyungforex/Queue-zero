import { describe, expect, it } from "vitest";
import { realtimeCadence } from "@/lib/realtime/cadence";

describe("realtime refresh cadence", () => {
  it("keeps a class dashboard immediate and slows organization-wide dashboards", () => {
    expect(realtimeCadence("class:11111111-1111-4111-8111-111111111111")).toEqual({ debounceMs: 180, pollMs: 15_000 });
    expect(realtimeCadence("queue:fixture").pollMs).toBe(15_000);
    expect(realtimeCadence("ticket:fixture").debounceMs).toBe(180);
    expect(realtimeCadence("school:22222222-2222-4222-8222-222222222222")).toEqual({ debounceMs: 2_000, pollMs: 30_000 });
    expect(realtimeCadence("business:33333333-3333-4333-8333-333333333333").pollMs).toBe(30_000);
  });
});
