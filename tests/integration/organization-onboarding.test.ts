import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn(), membership: vi.fn(), setCookie: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireUserId: mocks.user }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: async () => ({ rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.membership }) }) }) }) }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); }, unstable_rethrow: vi.fn() }));

import { onboardBusiness } from "@/app/onboarding/actions";

const workspaceId = "ac000000-0000-4000-8000-000000000001";
function form(organizationType: string) {
  const configurations: Record<string, { subtype: string; template: string; representative?: string }> = {
    UNIVERSITY_SCHOOL: { subtype: "UNIVERSITY", template: "STUDENT_SERVICES" },
    HOSPITAL_CLINIC: { subtype: "CLINIC", template: "RECEPTION" },
    BANK_FINANCIAL: { subtype: "COMMERCIAL_BANK", template: "CUSTOMER_SERVICE", representative: "Ada Representative" },
    SALON_BARBERSHOP: { subtype: "SALON", template: "WALK_IN_SERVICE" },
    GOVERNMENT_OFFICE: { subtype: "GOVERNMENT_AGENCY", template: "GENERAL_ENQUIRIES" },
    COMPANY_OTHER: { subtype: "COMPANY", template: "CUSTOM_SERVICE" },
  };
  const configuration = configurations[organizationType] ?? { subtype: "INVALID", template: "INVALID" };
  const data = new FormData();
  for (const [key, value] of Object.entries({ onboardingRequestId: "10000000-0000-4000-8000-000000000001", accountType: "ORGANIZATION", professionalCategory: "", organizationType, organizationSubtype: configuration.subtype, workspaceName: "School", legalName: "School Limited", representativeName: configuration.representative ?? "", serviceTemplates: configuration.template, teachingLevel: "", institutionName: "", serviceName: "", country: "NG", timezone: "Africa/Lagos", locationName: "Campus", locationAddress: "Main campus" })) data.set(key, value);
  return data;
}

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: workspaceId, error: null });
  mocks.membership.mockReset().mockResolvedValue({ data: { business_id: workspaceId }, error: null });
  mocks.user.mockReset().mockResolvedValue("user_owner");
  mocks.setCookie.mockReset();
});

describe("organization onboarding routing", () => {
  it("creates an education organization through the unified organization RPC", async () => {
    await expect(onboardBusiness({ status: "idle" }, form("UNIVERSITY_SCHOOL"))).rejects.toThrow("/dashboard?onboarding=complete");
    expect(mocks.rpc).toHaveBeenCalledWith("onboard_organization_workspace_v2", expect.objectContaining({ p_organization_type: "UNIVERSITY_SCHOOL", p_organization_subtype: "UNIVERSITY", p_workspace_name: "School" }));
  });

  it.each([
    ["HOSPITAL_CLINIC", "healthcare"],
    ["BANK_FINANCIAL", "financial_services"],
    ["SALON_BARBERSHOP", "beauty_wellness"],
    ["GOVERNMENT_OFFICE", "public_services"],
    ["COMPANY_OTHER", "other"],
  ])("maps %s to the unified organization RPC", async (organizationType) => {
    await expect(onboardBusiness({ status: "idle" }, form(organizationType))).rejects.toThrow("/dashboard?onboarding=complete");
    expect(mocks.rpc).toHaveBeenCalledWith("onboard_organization_workspace_v2", expect.objectContaining({ p_organization_type: organizationType, p_workspace_name: "School" }));
  });

  it("rejects an invalid organization type without touching the database", async () => {
    expect((await onboardBusiness({ status: "idle" }, form("ADMIN"))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
