import { describe, expect, it } from "vitest";
import { zonedWallTimeToUtc } from "@/lib/school/class-time";

describe("class wall time", () => {
  it("stores a Lagos class time as the matching UTC instant", () => {
    expect(zonedWallTimeToUtc("2026-11-19T14:00", "Africa/Lagos")).toBe("2026-11-19T13:00:00.000Z");
  });

  it("leaves an already offset timestamp unchanged", () => {
    expect(zonedWallTimeToUtc("2026-11-19T13:00:00.000Z", "Africa/Lagos")).toBe("2026-11-19T13:00:00.000Z");
  });
});
