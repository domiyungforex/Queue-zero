import { describe, expect, it } from "vitest";
import { queueSchema, queueStatusSchema } from "@/lib/validation/queue";
const valid = { name: " Consultation ", serviceName: " General Consultation ", description: " ", locationId: "30000000-0000-4000-8000-000000000001", serviceMinutes: "5", capacity: "", opensAt: "", closesAt: "", status: "open", warningThreshold: "3", phoneMode: "none" };
describe("queue settings validation", () => {
  it("normalizes text and converts minutes to seconds", () => {
    expect(queueSchema.parse(valid)).toMatchObject({ name: "Consultation", description: "", serviceMinutes: 300, warningThreshold: 3 });
    expect(queueSchema.parse({ ...valid, serviceMinutes: "1.5" }).serviceMinutes).toBe(90);
  });
  it.each([
    { name: " " }, { name: "x".repeat(161) }, { serviceName: " " }, { serviceName: "x".repeat(161) }, { description: "x".repeat(2001) },
    { locationId: "forged" }, { serviceMinutes: "" }, { serviceMinutes: "0" },
    { serviceMinutes: "Infinity" }, { serviceMinutes: "1441" }, { serviceMinutes: "NaN" },
    { warningThreshold: "" }, { warningThreshold: "-1" }, { warningThreshold: "1.5" },
    { warningThreshold: "101" }, { phoneMode: "sometimes" },
  ])("rejects invalid settings: %o", (change) => {
    expect(queueSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it("accepts all supported phone modes and threshold zero", () => {
    for (const phoneMode of ["none", "optional", "required"]) {
      expect(queueSchema.safeParse({ ...valid, phoneMode, warningThreshold: "0" }).success).toBe(true);
    }
  });
  it("rejects unsupported states", () => {
    expect(queueStatusSchema.safeParse("deleted").success).toBe(false);
  });
});
