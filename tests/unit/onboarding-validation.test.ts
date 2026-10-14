import { describe, expect, it } from "vitest";
import { ORGANIZATION_TYPE_VALUES, onboardingSchema } from "@/lib/validation/onboarding";

const organization = {
  onboardingRequestId: "10000000-0000-4000-8000-000000000001",
  accountType: "ORGANIZATION",
  professionalCategory: "",
  organizationType: "HOSPITAL_CLINIC",
  workspaceName: "Clinic",
  teachingLevel: "",
  institutionName: "",
  serviceName: "",
  country: "GH",
  timezone: "Africa/Accra",
  locationName: "Main",
  locationAddress: "Accra",
};
const individual = {
  onboardingRequestId: "10000000-0000-4000-8000-000000000002",
  accountType: "INDIVIDUAL",
  professionalCategory: "LECTURER_TEACHER",
  organizationType: "",
  workspaceName: "My teaching workspace",
  teachingLevel: "University undergraduate",
  institutionName: "",
  serviceName: "",
  country: "NG",
  timezone: "Africa/Lagos",
  locationName: "",
  locationAddress: "",
};

describe("unified onboarding validation", () => {
  it("normalizes organization details", () => {
    expect(onboardingSchema.parse({ ...organization, workspaceName: " Clinic ", country: "gh" })).toEqual(organization);
  });

  it.each(["workspaceName", "country", "timezone", "locationName", "locationAddress"])("requires organization %s", (field) => {
    expect(onboardingSchema.safeParse({ ...organization, [field]: "" }).success).toBe(false);
  });

  it("allows a lecturer workspace without organization or location claims", () => {
    expect(onboardingSchema.parse(individual)).toEqual(individual);
  });

  it.each(["DOCTOR", "NURSE", "BANKER", "BARBER_STYLIST", "CONSULTANT", "OTHER_PROFESSIONAL"])("accepts configured individual profession %s", (professionalCategory) => {
    expect(onboardingSchema.safeParse({
      ...individual,
      professionalCategory,
      teachingLevel: "",
      serviceName: "Customer service",
      locationName: "Main office",
      locationAddress: "Accra",
    }).success).toBe(true);
  });

  it("requires a real service and location for service professionals", () => {
    const result = onboardingSchema.safeParse({ ...individual, professionalCategory: "DOCTOR", teachingLevel: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.serviceName).toBeDefined();
      expect(result.error.flatten().fieldErrors.locationName).toBeDefined();
    }
  });

  it.each(ORGANIZATION_TYPE_VALUES)("accepts organization type %s", (organizationType) => {
    expect(onboardingSchema.safeParse({ ...organization, organizationType }).success).toBe(true);
  });

  it("requires an explicit account type", () => {
    const incomplete: Partial<typeof organization> = { ...organization };
    delete incomplete.accountType;
    expect(onboardingSchema.safeParse(incomplete).success).toBe(false);
  });

  it("requires a valid request key for retry-safe creation", () => {
    expect(onboardingSchema.safeParse({ ...organization, onboardingRequestId: "not-a-request-id" }).success).toBe(false);
  });

  it("does not accept submitted ownership fields", () => {
    expect(onboardingSchema.safeParse({ ...organization, owner_user_id: "user_victim" }).success).toBe(false);
  });

  it("accepts non-Latin workspace names", () => {
    expect(onboardingSchema.safeParse({ ...organization, workspaceName: "診療所" }).success).toBe(true);
  });
});
