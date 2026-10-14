import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), client: vi.fn(), rpc: vi.fn(), membership: vi.fn(), from: vi.fn(),
  setCookie: vi.fn(), revalidate: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));
vi.mock("@/lib/auth/server", () => ({ requireUserId: mocks.user }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: mocks.client }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unstable_rethrow: (error: unknown) => {
  if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
} }));

import { onboardBusiness } from "@/app/onboarding/actions";

const workspaceId = "d3f1a1b2-c3d4-4e5f-8a9b-012345678901";
const requestId = "10000000-0000-4000-8000-000000000001";
const validValues = { onboardingRequestId: requestId, accountType: "ORGANIZATION", professionalCategory: "", organizationType: "HOSPITAL_CLINIC", workspaceName: " Clinic A ", teachingLevel: "", institutionName: "", serviceName: "", country: "gh", timezone: "Africa/Accra", locationName: " Main ", locationAddress: " Accra " };
const individualValues = { onboardingRequestId: requestId, accountType: "INDIVIDUAL", professionalCategory: "LECTURER_TEACHER", organizationType: "", workspaceName: " My teaching workspace ", teachingLevel: "University undergraduate", institutionName: "Example University", serviceName: "", country: "ng", timezone: "Africa/Lagos", locationName: "", locationAddress: "" };
const form = (values = validValues) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};

beforeEach(() => {
  mocks.user.mockReset().mockResolvedValue("user_verified");
  mocks.membership.mockReset().mockResolvedValue({ data: { business_id: workspaceId }, error: null });
  const secondEq = vi.fn(() => ({ maybeSingle: mocks.membership }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  mocks.from.mockReset().mockReturnValue({ select });
  mocks.client.mockReset().mockResolvedValue({ rpc: mocks.rpc, from: mocks.from });
  mocks.rpc.mockReset().mockResolvedValue({ data: workspaceId, error: null });
  mocks.setCookie.mockReset();
  mocks.revalidate.mockReset();
  mocks.redirect.mockClear();
});

describe("onboarding server action", () => {
  it("authenticates, sends only validated organization fields, and redirects on success", async () => {
    const data = form();
    data.set("owner_user_id", "user_victim");
    data.set("business_id", "another-tenant");
    await expect(onboardBusiness({ status: "idle" }, data)).rejects.toThrow("NEXT_REDIRECT:/dashboard?onboarding=complete");
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("onboard_organization_workspace", {
      p_request_id: requestId, p_workspace_name: "Clinic A", p_organization_type: "HOSPITAL_CLINIC", p_country_code: "GH", p_timezone: "Africa/Accra", p_location_name: "Main", p_location_address: "Accra",
    });
    expect(mocks.from).toHaveBeenCalledWith("business_members");
    expect(mocks.setCookie).toHaveBeenCalledWith("queuezero-business", workspaceId, expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("uses the controlled professional RPC for an individual lecturer workspace", async () => {
    await expect(onboardBusiness({ status: "idle" }, form(individualValues))).rejects.toThrow("NEXT_REDIRECT:/dashboard?onboarding=complete");
    expect(mocks.rpc).toHaveBeenCalledWith("onboard_professional_workspace_v2", {
      p_workspace_name: "My teaching workspace",
      p_professional_category: "LECTURER_TEACHER",
      p_country_code: "NG",
      p_timezone: "Africa/Lagos",
      p_teaching_level: "University undergraduate",
      p_institution_name: "Example University",
      p_service_name: undefined,
      p_location_name: undefined,
      p_location_address: undefined,
    });
  });

  it.each(["DOCTOR", "NURSE", "BANKER", "BARBER_STYLIST", "CONSULTANT", "OTHER_PROFESSIONAL"])("persists configured %s onboarding through the same professional RPC", async (professionalCategory) => {
    const values = {
      ...individualValues,
      professionalCategory,
      teachingLevel: "",
      institutionName: "",
      serviceName: "Customer service",
      locationName: "Main office",
      locationAddress: "Accra",
    };
    await expect(onboardBusiness({ status: "idle" }, form(values))).rejects.toThrow("NEXT_REDIRECT:/dashboard?onboarding=complete");
    expect(mocks.rpc).toHaveBeenCalledWith("onboard_professional_workspace_v2", expect.objectContaining({
      p_professional_category: professionalCategory,
      p_service_name: "Customer service",
      p_location_name: "Main office",
      p_location_address: "Accra",
    }));
  });

  it("does not redirect until the persisted membership can be read", async () => {
    mocks.membership.mockResolvedValue({ data: null, error: null });
    const result = await onboardBusiness({ status: "idle" }, form());
    expect(result).toMatchObject({ status: "error", values: validValues });
    expect(result.message).toContain("saved");
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns field errors and keeps submitted values without touching the database", async () => {
    const values = { ...validValues, workspaceName: " ", timezone: "Invalid/Zone", country: "ZZ" };
    const state = await onboardBusiness({ status: "idle" }, form(values));
    expect(state.status).toBe("error");
    expect(state.values).toEqual(values);
    expect(state.fieldErrors?.workspaceName).toBeDefined();
    expect(state.fieldErrors?.timezone).toBeDefined();
    expect(state.fieldErrors?.country).toBeDefined();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("requires authentication even for invalid forms", async () => {
    const authRedirect = new Error("NEXT_REDIRECT:/sign-in");
    mocks.user.mockRejectedValue(authRedirect);
    await expect(onboardBusiness({ status: "idle" }, new FormData())).rejects.toBe(authRedirect);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not expose database error details or discard input after a failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "sensitive-provider-detail" } });
    const result = await onboardBusiness({ status: "idle" }, form());
    expect(result.status).toBe("error");
    expect(result.values).toEqual(validValues);
    expect(JSON.stringify(result)).not.toContain("sensitive-provider-detail");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("handles transport failures without claiming the transaction failed to commit", async () => {
    mocks.rpc.mockRejectedValue(new Error("timeout"));
    const result = await onboardBusiness({ status: "idle" }, form());
    expect(result.status).toBe("error");
    expect(result.message).toContain("try again");
  });

  it("preserves a Clerk redirect if the session expires during submission", async () => {
    const authRedirect = new Error("NEXT_REDIRECT:/sign-in");
    mocks.client.mockRejectedValue(authRedirect);
    await expect(onboardBusiness({ status: "idle" }, form())).rejects.toBe(authRedirect);
  });

  it("rejects an unexpected successful response shape", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await onboardBusiness({ status: "idle" }, form())).status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("bounds oversized reflected field values", async () => {
    const result = await onboardBusiness({ status: "idle" }, form({ ...validValues, locationAddress: "x".repeat(5000) }));
    expect(result.fieldErrors?.locationAddress).toBeDefined();
    expect(result.values?.locationAddress).toHaveLength(1000);
  });
});
