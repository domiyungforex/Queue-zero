import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { protect, redirect } = vi.hoisted(() => ({ protect: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }) }));
vi.mock("server-only", () => ({}));
const selectedBusiness = vi.hoisted(() => ({ value: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => selectedBusiness.value ? selectedBusiness : undefined }) }));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect }, currentUser: vi.fn().mockResolvedValue(null) }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: vi.fn() }));
vi.mock("@/components/ui/page-shell", () => ({ PageShell: () => null }));

import DashboardPage from "@/app/dashboard/page";
import DashboardLayout from "@/app/dashboard/layout";
import OnboardingPage from "@/app/onboarding/page";
import { getCurrentMembership, getWorkspaceMembership, requireBusinessManager, requireBusinessOwner } from "@/lib/business/membership";

let rows: { business_id: string; role: string; businesses: { name: string; onboarding_completed_at?: string } }[];
let responseStatus: number;
const requests: URL[] = [];
beforeEach(() => {
  selectedBusiness.value = "";
  rows = [{ business_id: "business-a", role: "owner", businesses: { name: "Clinic A" } }];
  responseStatus = 200;
  requests.length = 0;
  protect.mockReset().mockResolvedValue({ userId: "user_verified", getToken: async () => "clerk-session" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://queuezero.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(new Request(input, init).url);
    requests.push(url);
    if (url.pathname.endsWith("/business_metrics")) return new Response(JSON.stringify({timezone:"UTC",days:7,waiting:0,serving:0,joins:0,joins_today:0,completed:0,completed_today:0,no_shows:0,cancelled:0,average_wait_seconds:null,average_service_seconds:null,daily:[],hourly:[]}), {headers:{"Content-Type":"application/json"}});
    if (url.pathname.endsWith("/queues")) return new Response("[]", { headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify(responseStatus === 200 ? rows : { message: "Unavailable" }), { status: responseStatus, headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("authenticated membership routing with mocked Clerk and database transport", () => {
  it("allows members into the dashboard", async () => {
    expect(isValidElement(await DashboardPage())).toBe(true);
    expect(isValidElement(await DashboardLayout({ children: "dashboard content" }))).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows confirmation only after onboarding persistence redirects back", async () => {
    rows[0].businesses.onboarding_completed_at = "2026-10-14T08:00:00.000Z";
    const page = await DashboardPage({ searchParams: Promise.resolve({ onboarding: "complete" }) });
    expect(renderToStaticMarkup(page)).toContain("Your workspace is ready.");
  });

  it("does not trust the onboarding query without persisted completion", async () => {
    const page = await DashboardPage({ searchParams: Promise.resolve({ onboarding: "complete" }) });
    expect(renderToStaticMarkup(page)).not.toContain("Your workspace is ready.");
  });

  it("selects the signed-in user's membership, including when they can read other members", async () => {
    await expect(getCurrentMembership()).resolves.toEqual({ businessId: "business-a", role: "owner", businessName: "Clinic A" });
    expect(requests[0].searchParams.get("clerk_user_id")).toBe("eq.user_verified");
    expect(requests[0].searchParams.get("limit")).toBeNull();
    expect(requests[0].searchParams.get("order")).toBe("created_at.asc,id.asc");
  });

  it("selects only a verified membership and ignores a forged preference", async () => {
    rows.push({ business_id: "business-b", role: "staff", businesses: { name: "Clinic B" } });
    selectedBusiness.value = "business-b";
    expect((await getCurrentMembership())?.businessId).toBe("business-b");
    selectedBusiness.value = "another-tenant";
    expect((await getCurrentMembership())?.businessId).toBe("business-a");
  });

  it("rechecks the selected workspace role before allowing owner routes", async () => {
    rows.push({ business_id: "business-b", role: "staff", businesses: { name: "Clinic B" } });
    selectedBusiness.value = "business-b";
    await expect(requireBusinessOwner()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("verifies an exact workspace membership directly against the signed-in user", async () => {
    await expect(getWorkspaceMembership("business-a")).resolves.toMatchObject({ businessId: "business-a", role: "owner" });
    const request = requests.at(-1);
    expect(request?.searchParams.get("clerk_user_id")).toBe("eq.user_verified");
    expect(request?.searchParams.get("business_id")).toBe("eq.business-a");
  });

  it("treats a removed membership as unavailable", async () => {
    rows = [];
    await expect(getWorkspaceMembership("business-a")).resolves.toBeNull();
  });

  it("scopes the queue query to the authorized workspace", async () => {
    await DashboardPage();
    expect(requests.find((url) => url.pathname.endsWith("/queues"))?.searchParams.get("business_id")).toBe("eq.business-a");
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

  it("lets an existing member deliberately add another workspace", async () => {
    expect(isValidElement(await OnboardingPage({ searchParams: Promise.resolve({ new: "workspace" }) }))).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps workspace switching available for student memberships", async () => {
    rows[0].role = "student";
    expect(renderToStaticMarkup(await DashboardPage())).toContain("Use the workspace switcher above");
    expect(redirect).not.toHaveBeenCalledWith("/attend");
  });

  it("does not interpret a database failure as missing membership", async () => {
    responseStatus = 503;
    await expect(DashboardPage()).rejects.toThrow("could not be loaded");
    expect(renderToStaticMarkup(await DashboardLayout({ children: "private" }))).toContain("could not be loaded");
    await expect(OnboardingPage()).rejects.toThrow("could not be loaded");
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

describe("dashboard role boundaries", () => {
  it("denies staff manager and owner views", async () => {
    rows[0].role = "staff";
    await expect(requireBusinessManager()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    await expect(requireBusinessOwner()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
  it("allows admins manager views but denies billing and settings", async () => {
    rows[0].role = "admin";
    expect((await requireBusinessManager()).role).toBe("admin");
    await expect(requireBusinessOwner()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
});
