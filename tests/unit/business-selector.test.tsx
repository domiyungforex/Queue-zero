// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    // CustomDropdown renders a hidden <input id="businessId"> for the form value and a <button> trigger.
    const hiddenInput = document.getElementById("businessId") as HTMLInputElement;
    expect(hiddenInput).toBeTruthy();
    expect(hiddenInput.value).toBe(personalId);

    // Open the dropdown to inspect option labels.
    const trigger = screen.getByRole("button", { name: /Workspace/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: /My teaching/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /North University/ })).toBeTruthy();

    // Organisation IDs must not appear in readable content.
    expect(document.body.textContent).not.toContain(organizationId);
    expect(screen.getByRole("button", { name: "Switch workspace" })).toBeTruthy();
  });

  it("offers workspace creation without rendering a redundant switcher", () => {
    render(<BusinessSelector businessId="only" memberships={[
      { businessId: "only", businessName: "Only workspace", workspaceOwnership: "INDIVIDUAL" },
    ]} />);
    // Single membership: no dropdown trigger, just an Add link.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("link", { name: "Add workspace" }).getAttribute("href")).toBe("/onboarding?new=workspace");
  });

  it("renders the compact mobile selector with only authorized memberships", () => {
    render(<MobileWorkspaceSwitcher businessId="personal" contextLabel="Lecturer · School" education memberships={[
      { businessId: "personal", businessName: "My practice", workspaceOwnership: "INDIVIDUAL", role: "owner" },
      { businessId: "clinic", businessName: "General Clinic", workspaceOwnership: "ORGANIZATION", role: "staff" },
    ]} />);
    expect(screen.getAllByText("My practice")).toHaveLength(2);
    expect(screen.getByText("Lecturer · School")).toBeTruthy();
    expect(screen.getAllByText(/Personal Workspace/).length).toBeGreaterThan(0);
    expect(screen.getByText("General Clinic")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add workspace" }).getAttribute("href")).toBe("/onboarding?new=workspace");
  });
});
