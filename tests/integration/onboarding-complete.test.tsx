import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  client: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }),
}));

vi.mock("@/lib/business/membership", () => ({ getCurrentMembership: mocks.membership }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/onboarding/onboarding-ui", () => ({
  OnboardingShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  SuccessPanel: ({ name, pendingVerification }: { name: string; pendingVerification: boolean }) => (
    <section><h1>{pendingVerification ? "Request received" : "Your workspace is ready!"}</h1><p>{name}</p></section>
  ),
}));

import OnboardingCompletePage from "@/app/onboarding/complete/page";

beforeEach(() => {
  mocks.redirect.mockClear();
  mocks.membership.mockReset();
  mocks.maybeSingle.mockReset().mockResolvedValue({ data: { verification_status: "UNVERIFIED" }, error: null });
  const eq = vi.fn(() => ({ maybeSingle: mocks.maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.client.mockReset().mockResolvedValue({ from: vi.fn(() => ({ select })) });
});

describe("verified onboarding completion result", () => {
  it("redirects when no persisted membership exists", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(OnboardingCompletePage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("does not show success without persisted onboarding completion", async () => {
    mocks.membership.mockResolvedValue({ businessId: "workspace-a", businessName: "Workspace", workspaceOwnership: "PERSONAL" });
    await expect(OnboardingCompletePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("shows a ready state for a confirmed personal workspace", async () => {
    mocks.membership.mockResolvedValue({ businessId: "workspace-a", businessName: "Ada Teaching", workspaceOwnership: "PERSONAL", onboardingCompletedAt: "2026-10-16T10:00:00Z" });
    const markup = renderToStaticMarkup(await OnboardingCompletePage());
    expect(markup).toContain("Your workspace is ready!");
    expect(markup).toContain("Ada Teaching");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("shows pending verification for an unverified organization", async () => {
    mocks.membership.mockResolvedValue({ businessId: "workspace-a", businessName: "North Finance", workspaceOwnership: "ORGANIZATION", onboardingCompletedAt: "2026-10-16T10:00:00Z" });
    const markup = renderToStaticMarkup(await OnboardingCompletePage());
    expect(markup).toContain("Request received");
  });

  it("does not claim success if organization verification cannot be read", async () => {
    mocks.membership.mockResolvedValue({ businessId: "workspace-a", businessName: "North Finance", workspaceOwnership: "ORGANIZATION", onboardingCompletedAt: "2026-10-16T10:00:00Z" });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(OnboardingCompletePage()).rejects.toThrow("verification state could not be confirmed");
  });
});
