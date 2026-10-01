import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { protect, redirect } = vi.hoisted(() => ({ protect: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect } }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: vi.fn() }));
vi.mock("@/components/ui/page-shell", () => ({ PageShell: () => null }));

import DashboardPage from "@/app/dashboard/page";
import DashboardLayout from "@/app/dashboard/layout";
import OnboardingPage from "@/app/onboarding/page";
import { getCurrentMembership } from "@/lib/business/membership";

let rows: { business_id: string; role: string; businesses: { name: string } }[];
let responseStatus: number;
const requests: URL[] = [];
beforeEach(() => {
  rows = [{ business_id: "business-a", role: "owner", businesses: { name: "Clinic A" } }];
  responseStatus = 200;
  requests.length = 0;
  protect.mockReset().mockResolvedValue({ userId: "user_verified", getToken: async () => "clerk-session" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://queuezero.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new URL(new Request(input, init).url));
    return new Response(JSON.stringify(responseStatus === 200 ? rows : { message: "Unavailable" }), { status: responseStatus, headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("authenticated membership routing with mocked Clerk and database transport", () => {
  it("allows members into the dashboard", async () => {
    expect(isValidElement(await DashboardPage())).toBe(true);
    await expect(DashboardLayout({ children: "dashboard content" })).resolves.toBe("dashboard content");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("selects the signed-in user's membership, including when they can read other members", async () => {
    await expect(getCurrentMembership()).resolves.toEqual({ businessId: "business-a", role: "owner", businessName: "Clinic A" });
    expect(requests[0].searchParams.get("clerk_user_id")).toBe("eq.user_verified");
    expect(requests[0].searchParams.get("limit")).toBe("1");
    expect(requests[0].searchParams.get("order")).toBe("created_at.asc,id.asc");
  });

  it("redirects a new user from both dashboard boundaries to onboarding", async () => {
    rows = [];
    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    await expect(DashboardLayout({ children: "private" })).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("shows the setup page only to users with no membership", async () => {
    rows = [];
    expect(isValidElement(await OnboardingPage())).toBe(true);
  });

  it("redirects existing members away from onboarding", async () => {
    await expect(OnboardingPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("does not interpret a database failure as missing membership", async () => {
    responseStatus = 503;
    await expect(DashboardPage()).rejects.toThrow("couldn’t load your business");
    await expect(OnboardingPage()).rejects.toThrow("couldn’t load your business");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects anonymous requests before querying business data", async () => {
    const authRedirect = new Error("NEXT_REDIRECT:/sign-in");
    protect.mockRejectedValue(authRedirect);
    await expect(DashboardPage()).rejects.toBe(authRedirect);
    await expect(DashboardLayout({ children: "private" })).rejects.toBe(authRedirect);
    await expect(OnboardingPage()).rejects.toBe(authRedirect);
    expect(requests).toHaveLength(0);
  });
});
