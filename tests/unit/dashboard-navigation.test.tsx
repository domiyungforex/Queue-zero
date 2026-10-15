// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/queues" }));
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { QueueSummary } from "@/components/dashboard/queue-summary";
afterEach(cleanup);
it("shows service-professional navigation and marks the active route", () => {
  render(<DashboardNavigation role="owner" workspaceOwnership="INDIVIDUAL" professionalCategory="DOCTOR" />);
  expect(screen.getByRole("link", { name: "Services" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Customers" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Analytics" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Appointments" })).toBeNull();
  expect(screen.getByRole("link", { name: "Queues" }).getAttribute("aria-current")).toBe("page");
});
it("limits staff navigation and explains an empty assignment list", () => {
  render(<><DashboardNavigation role="staff" workspaceOwnership="ORGANIZATION" /><QueueSummary queues={[]} staff /></>);
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.getByText("No queues assigned")).toBeTruthy();
});
it("hides owner-only navigation for admins", () => {
  render(<DashboardNavigation role="admin" workspaceOwnership="ORGANIZATION" />);
  expect(screen.getByRole("link", { name: "Staff & roles" })).toBeTruthy();
  expect(screen.queryByText("Billing")).toBeNull();
  expect(screen.queryByText("Settings")).toBeNull();
});
it("renders real queue data and never invents waiting counts", () => {
  render(<QueueSummary queues={[{ id: "queue", name: "Consultation", description: null, status: "paused", average_service_seconds: 300, locations: { name: "Main branch" } }]} />);
  expect(screen.getByRole("heading", { name: "Consultation" })).toBeTruthy();
  expect(screen.getByText("paused")).toBeTruthy();
  expect(screen.getByText("Main branch")).toBeTruthy();
  expect(screen.queryByText(/waiting/i)).toBeNull();
});
