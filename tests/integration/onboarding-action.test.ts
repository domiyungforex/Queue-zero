import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }) }));
vi.mock("@/lib/auth/server", () => ({ requireUserId: mocks.user }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unstable_rethrow: (error: unknown) => {
  if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
} }));

import { onboardBusiness } from "@/app/onboarding/actions";

const validValues = { businessName: " Clinic A ", industry: "healthcare", country: "gh", timezone: "Africa/Accra", locationName: " Main ", locationAddress: " Accra " };
const form = (values = validValues) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};

beforeEach(() => {
  mocks.user.mockReset().mockResolvedValue("user_verified");
  mocks.client.mockReset().mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockReset().mockResolvedValue({ data: "d3f1a1b2-c3d4-4e5f-8a9b-012345678901", error: null });
});

describe("onboarding server action", () => {
  it("authenticates, sends only validated business fields, and redirects on success", async () => {
    const data = form();
    data.set("owner_user_id", "user_victim");
    data.set("business_id", "another-tenant");
    await expect(onboardBusiness({ status: "idle" }, data)).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("onboard_business", {
      p_business_name: "Clinic A", p_industry: "healthcare", p_country_code: "GH", p_timezone: "Africa/Accra", p_location_name: "Main", p_location_address: "Accra",
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("returns field errors and keeps submitted values without touching the database", async () => {
    const values = { ...validValues, businessName: " ", timezone: "Invalid/Zone", country: "ZZ" };
    const state = await onboardBusiness({ status: "idle" }, form(values));
    expect(state.status).toBe("error");
    expect(state.values).toEqual(values);
    expect(state.fieldErrors?.businessName).toBeDefined();
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
