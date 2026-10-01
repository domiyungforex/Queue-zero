import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const { protect } = vi.hoisted(() => ({ protect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect } }));
vi.mock("@/components/ui/page-shell", () => ({ PageShell: () => null }));

import DashboardPage from "@/app/dashboard/page";
import DashboardLayout from "@/app/dashboard/layout";

describe("dashboard resource boundaries with a mocked Clerk session", () => {
  it("allows a verified session into the dashboard", async () => {
    protect.mockResolvedValue({ userId: "user_verified" });
    expect(isValidElement(await DashboardPage())).toBe(true);
    await expect(DashboardLayout({ children: "dashboard content" })).resolves.toBe("dashboard content");
    expect(protect).toHaveBeenCalledTimes(2);
  });

  it("rejects anonymous requests at both the page and layout", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    protect.mockRejectedValue(redirect);
    await expect(DashboardPage()).rejects.toBe(redirect);
    await expect(DashboardLayout({ children: "private content" })).rejects.toBe(redirect);
  });
});
