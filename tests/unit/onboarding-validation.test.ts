import { describe, expect, it } from "vitest";
import { ORGANIZATION_TYPE_VALUES, onboardingSchema } from "@/lib/validation/onboarding";

const organization = {
  onboardingRequestId: "10000000-0000-4000-8000-000000000001",
  accountType: "ORGANIZATION",
  professionalCategory: "",
  organizationType: "HOSPITAL_CLINIC",
  organizationSubtype: "CLINIC",
  workspaceName: "Clinic",
  legalName: "Clinic Limited",
  representativeName: "",
  serviceTemplates: "RECEPTION,CONSULTATION",
  teachingLevel: "",
  institutionName: "",
  serviceName: "",
  country: "GH",
  timezone: "Africa/Accra",
  locationName: "Main",
  locationAddress: "Accra",
  authorizationDeclaration: "true",
};
const individual = {
  onboardingRequestId: "10000000-0000-4000-8000-000000000002",
  accountType: "INDIVIDUAL",
  professionalCategory: "LECTURER_TEACHER",
  organizationType: "",
  organizationSubtype: "",
  workspaceName: "My teaching workspace",
  legalName: "",
  representativeName: "",
  serviceTemplates: "",
  teachingLevel: "University undergraduate",
  institutionName: "",
  serviceName: "",
  country: "NG",
  timezone: "Africa/Lagos",
  locationName: "",
  locationAddress: "",
  authorizationDeclaration: "",
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

  it.each([
    ["UNIVERSITY_SCHOOL", "UNIVERSITY", "STUDENT_SERVICES"],
    ["HOSPITAL_CLINIC", "CLINIC", "RECEPTION"],
    ["BANK_FINANCIAL", "COMMERCIAL_BANK", "CUSTOMER_SERVICE"],
    ["SALON_BARBERSHOP", "SALON", "WALK_IN_SERVICE"],
    ["GOVERNMENT_OFFICE", "GOVERNMENT_AGENCY", "GENERAL_ENQUIRIES"],
    ["COMPANY_OTHER", "COMPANY", "CUSTOM_SERVICE"],
  ])("accepts configured organization type %s", (organizationType, organizationSubtype, serviceTemplates) => {
    expect(onboardingSchema.safeParse({
      ...organization,
      organizationType,
      organizationSubtype,
      serviceTemplates,
      representativeName: organizationType === "BANK_FINANCIAL" ? "Ada Representative" : "",
    }).success).toBe(true);
  });

  it("requires bank representative and category-safe service templates", () => {
    const bank = { ...organization, organizationType: "BANK_FINANCIAL", organizationSubtype: "COMMERCIAL_BANK", serviceTemplates: "RECEPTION" };
    const result = onboardingSchema.safeParse(bank);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.representativeName).toBeDefined();
      expect(result.error.flatten().fieldErrors.serviceTemplates).toBeDefined();
    }
  });

  it("keeps the complete category list stable", () => {
    expect(ORGANIZATION_TYPE_VALUES).toHaveLength(17);
  });

  it("requires an explicit account type", () => {
    const incomplete: Partial<typeof organization> = { ...organization };
    delete incomplete.accountType;
    expect(onboardingSchema.safeParse(incomplete).success).toBe(false);
  });

  it("requires an organization registrant to confirm their authority", () => {
    const result = onboardingSchema.safeParse({ ...organization, authorizationDeclaration: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.authorizationDeclaration).toBeDefined();
    }
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
