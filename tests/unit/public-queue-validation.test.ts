import { describe, expect, it } from "vitest";
import { publicQueueSchema } from "@/lib/validation/public-queue";
import { formatPublicWait } from "@/lib/queue/public-wait";
import { publicQueueFixture as fixture } from "@/tests/fixtures/public-queue";

describe("public logo validation", () => {
  it.each(["javascript:alert(1)", "data:image/svg+xml,evil", "http://example.com/logo.png", "https://user:password@example.com/logo.png", "https://", "not-a-url"])("uses the fallback for %s", (url) => {
    expect(publicQueueSchema.parse({ ...fixture, business_logo_url: url }).business_logo_url).toBeNull();
  });
  it("accepts a valid HTTPS logo", () => {
    const logo = "https://example.com/logo.png";
    expect(publicQueueSchema.parse({ ...fixture, business_logo_url: logo }).business_logo_url).toBe(logo);
  });
});
describe("landing-page wait presentation", () => {
  it.each([[60, "Under 5 min"], [300, "About 5–10 min"], [1020, "About 15–20 min"], [3600, "About 1–2 hr"], [86400, "About 1–2 days"]])("rounds %s seconds to %s", (seconds, label) => {
    expect(formatPublicWait({ ...fixture, estimated_wait_seconds: Number(seconds) })).toBe(label);
  });
  it("does not promise zero wait while someone is being served", () => {
    expect(formatPublicWait({ ...fixture, estimated_wait_seconds: 0, has_serving_customer: true })).toBe("After the current customer");
    expect(formatPublicWait({ ...fixture, estimated_wait_seconds: 0, has_serving_customer: false })).toBe("No wait expected");
  });
  it("does not show an active estimate for paused or closed queues", () => {
    for (const status of ["paused", "closed"] as const) expect(formatPublicWait({ ...fixture, status, estimated_wait_seconds: null })).toContain("Unavailable");
  });
});
