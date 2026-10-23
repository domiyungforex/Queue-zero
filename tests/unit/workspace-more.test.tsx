// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), institution: vi.fn() }));
vi.mock("@/lib/business/membership", () => ({ requireBusinessMembership: mocks.membership }));
vi.mock("@/lib/institution/data", () => ({ getInstitutionSnapshot: mocks.institution }));
vi.mock("@/components/auth/auth-navigation", () => ({ AuthNavigation: () => <button>Sign out</button> }));
import MorePage from "@/app/dashboard/more/page";

beforeEach(() => {
  mocks.membership.mockResolvedValue({ businessName: "Workspace name", role: "owner", workspaceOwnership: "ORGANIZATION", organizationMode: "SCHOOL" });
  mocks.institution.mockResolvedValue({ snapshot: { units: [] } });
});
afterEach(cleanup);

it("makes secondary education workflows reachable from More", async () => {
  render(await MorePage());
  expect(screen.getByRole("link", { name: /Class setup/ }).getAttribute("href")).toBe("/dashboard/courses");
  expect(screen.getByRole("link", { name: /Queues/ }).getAttribute("href")).toBe("/dashboard/queues");
  expect(screen.getByRole("link", { name: /Reports/ }).getAttribute("href")).toBe("/dashboard/exports");
  expect(screen.getByRole("link", { name: /Notifications/ }).getAttribute("href")).toBe("/dashboard/notifications");
});
it("uses business identity and reporting instead of education routes for business workspaces", async () => {
  mocks.membership.mockResolvedValue({ businessName: "Workshop", role: "owner", workspaceOwnership: "ORGANIZATION", organizationMode: "BUSINESS" });
  render(await MorePage());
  expect(screen.getByText("Owner · Organization Workspace")).toBeTruthy();
  expect(screen.queryByText(/Education/)).toBeNull();
  expect(screen.queryByRole("link", { name: /Class setup/ })).toBeNull();
  expect(screen.getByRole("link", { name: /Reports/ }).getAttribute("href")).toBe("/dashboard/analytics");
});
it("uses institution staff permissions and the authorized people route", async () => {
  mocks.membership.mockResolvedValue({ businessName: "Institution", role: "staff", institutionType: "UNIVERSITY", workspaceOwnership: "ORGANIZATION", organizationMode: "SCHOOL" });
  mocks.institution.mockResolvedValue({ snapshot: { units: [{ permissions: ["unit.staff.manage"] }] } });
  render(await MorePage());
  expect(screen.getByRole("link", { name: /Team members/ }).getAttribute("href")).toBe("/dashboard/people");
  expect(screen.getByRole("link", { name: /Units/ }).getAttribute("href")).toBe("/dashboard/units");
  for (const name of [/Class setup/, /Reports/, /^Settings/, /^Billing/]) expect(screen.queryByRole("link", { name })).toBeNull();
});
it("keeps personal lecturer identity and exposes optional class setup", async () => {
  mocks.membership.mockResolvedValue({ businessName: "My teaching", role: "owner", workspaceOwnership: "INDIVIDUAL", professionalCategory: "LECTURER_TEACHER", organizationMode: "SCHOOL" });
  render(await MorePage());
  expect(screen.getByText("Owner · Personal Workspace")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /^Queues/ })).toBeNull();
  expect(screen.getByRole("link", { name: /Class setup/ })).toBeTruthy();
});
