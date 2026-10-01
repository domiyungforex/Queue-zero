import { describe, expect, it } from "vitest";
import { onboardingSchema } from "@/lib/validation/onboarding";

const valid = { businessName: "Clinic", industry: "healthcare", country: "GH", timezone: "Africa/Accra", locationName: "Main", locationAddress: "Accra" };

describe("onboarding validation", () => {
  it("trims business details and normalizes the country", () => {
    expect(onboardingSchema.parse({ ...valid, businessName: " Clinic ", country: "gh" })).toEqual(valid);
  });
  it.each(["businessName", "industry", "country", "timezone", "locationName", "locationAddress"])("requires %s", (field) => {
    expect(onboardingSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
  });
  it.each(["businessName", "locationName", "locationAddress"])("bounds %s", (field) => {
    expect(onboardingSchema.safeParse({ ...valid, [field]: "x".repeat(501) }).success).toBe(false);
  });
  it("does not accept ownership fields", () => {
    expect(onboardingSchema.safeParse({ ...valid, owner_user_id: "user_victim" }).success).toBe(false);
  });
  it("accepts non-Latin business names", () => {
    expect(onboardingSchema.safeParse({ ...valid, businessName: "診療所" }).success).toBe(true);
  });
});
