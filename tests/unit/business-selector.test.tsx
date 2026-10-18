// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/actions", () => ({ switchBusiness: vi.fn() }));

import { BusinessSelector } from "@/components/dashboard/business-selector";
import { MobileWorkspaceSwitcher } from "@/components/dashboard/mobile-workspace-switcher";

afterEach(cleanup);

describe("BusinessSelector", () => {
  it("identifies personal and organization memberships without exposing IDs", () => {
    const personalId = "00000000-0000-4000-8000-000000000001";
    const organizationId = "00000000-0000-4000-8000-000000000002";
    render(<BusinessSelector businessId={personalId} memberships={[
      { businessId: personalId, businessName: "My teaching", workspaceOwnership: "INDIVIDUAL" },
      { businessId: organizationId, businessName: "North University", workspaceOwnership: "ORGANIZATION" },
    ]} />);

    const select = screen.getByRole("combobox", { name: "Workspace" }) as HTMLSelectElement;
    expect(select.value).toBe(personalId);
    expect(screen.getByRole("option", { name: "My teaching — Personal" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "North University — Organization" })).toBeTruthy();
    expect(document.body.textContent).not.toContain(organizationId);
    expect(screen.getByRole("button", { name: "Switch workspace" })).toBeTruthy();
  });

  it("offers workspace creation without rendering a redundant switcher", () => {
    render(<BusinessSelector businessId="only" memberships={[
      { businessId: "only", businessName: "Only workspace", workspaceOwnership: "INDIVIDUAL" },
    ]} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("link", { name: "Add workspace" }).getAttribute("href")).toBe("/onboarding?new=workspace");
  });

  it("renders the compact mobile selector with only authorized memberships", () => {
    render(<MobileWorkspaceSwitcher businessId="personal" memberships={[
      { businessId: "personal", businessName: "My practice", workspaceOwnership: "INDIVIDUAL", role: "owner" },
      { businessId: "clinic", businessName: "General Clinic", workspaceOwnership: "ORGANIZATION", role: "staff" },
    ]} />);
    expect(screen.getAllByText("My practice")).toHaveLength(2);
    expect(screen.getAllByText(/Personal Workspace/).length).toBeGreaterThan(0);
    expect(screen.getByText("General Clinic")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add workspace" }).getAttribute("href")).toBe("/onboarding?new=workspace");
  });
});
