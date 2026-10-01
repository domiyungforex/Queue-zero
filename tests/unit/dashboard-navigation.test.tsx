// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/queues" }));
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { QueueSummary } from "@/components/dashboard/queue-summary";
afterEach(cleanup);
it("shows owner navigation and marks the active route", () => {
  render(<DashboardNavigation role="owner" />);
  expect(screen.getAllByRole("link")).toHaveLength(6);
  expect(screen.getByRole("link", { name: "Queues" }).getAttribute("aria-current")).toBe("page");
});
it("limits staff navigation and explains an empty assignment list", () => {
  render(<><DashboardNavigation role="staff" /><QueueSummary queues={[]} staff /></>);
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.getByText("No queues assigned")).toBeTruthy();
});
it("hides owner-only navigation for admins", () => {
  render(<DashboardNavigation role="admin" />);
  expect(screen.getAllByRole("link")).toHaveLength(4);
  expect(screen.queryByText("Billing")).toBeNull();
});
it("renders real queue data and never invents waiting counts", () => {
  render(<QueueSummary queues={[{ id: "queue", name: "Consultation", description: null, status: "paused", average_service_seconds: 300, locations: { name: "Main branch" } }]} />);
  expect(screen.getByText("Consultation")).toBeTruthy();
  expect(screen.getByText("paused")).toBeTruthy();
  expect(screen.getByText("Main branch")).toBeTruthy();
  expect(screen.queryByText(/waiting/i)).toBeNull();
});
