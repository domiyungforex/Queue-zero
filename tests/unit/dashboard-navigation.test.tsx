// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ pathname: "/dashboard/queues" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { QueueSummary } from "@/components/dashboard/queue-summary";
afterEach(cleanup);
beforeEach(() => { route.pathname = "/dashboard/queues"; });
it("shows service-professional navigation and marks the active route", () => {
  render(<DashboardNavigation role="owner" workspaceOwnership="INDIVIDUAL" professionalCategory="DOCTOR" />);
  expect(screen.getByRole("link", { name: "Services" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Customers" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Analytics" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Appointments" })).toBeNull();
  expect(screen.getByRole("link", { name: "Queues" }).getAttribute("aria-current")).toBe("page");
});
it("uses exactly five route-aware primary destinations for a personal mobile workspace", () => {
  render(<DashboardNavigation variant="mobile" role="owner" workspaceOwnership="INDIVIDUAL" professionalCategory="CONSULTANT" />);
  for (const name of ["Overview", "Services", "Queues", "Customers", "Analytics"]) expect(screen.getByRole("link", { name })).toBeTruthy();
  expect(screen.queryByText("More")).toBeNull();
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
it("keeps school mobile navigation within the user's teaching capabilities", () => {
  const { rerender } = render(<DashboardNavigation variant="mobile" role="staff" mode="SCHOOL" />);
  expect(screen.getByRole("link", { name: "Queues" })).toBeTruthy();
  for (const name of ["Classes", "Attendance", "Students"]) expect(screen.queryByRole("link", { name })).toBeNull();
  rerender(<DashboardNavigation variant="mobile" role="staff" mode="SCHOOL" institution institutionTeaching />);
  for (const name of ["Home", "Classes", "Attendance", "Students", "More"]) expect(screen.getByRole("link", { name })).toBeTruthy();
  expect(screen.getAllByRole("link")).toHaveLength(5);
  rerender(<DashboardNavigation variant="mobile" role="student" mode="SCHOOL" />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
it.each([
  ["/dashboard/courses/course-id", "Classes"],
  ["/dashboard/attendance/class-id", "Attendance"],
  ["/dashboard/notifications", "More"],
  ["/dashboard/people", "More"],
  ["/dashboard/exports", "More"],
  ["/dashboard/queues/queue-id", "More"],
])("highlights the matching education destination on %s", (pathname, label) => {
  route.pathname = pathname;
  render(<DashboardNavigation variant="mobile" role="owner" mode="SCHOOL" />);
  expect(screen.getByRole("link", { name: label }).getAttribute("aria-current")).toBe("page");
  expect(screen.getAllByRole("link").filter(link => link.getAttribute("aria-current") === "page")).toHaveLength(1);
});
it("highlights More for secondary business pages and closes it after selection or Escape", () => {
  route.pathname = "/dashboard/settings";
  const { container } = render(<DashboardNavigation variant="mobile" role="owner" />);
  const menu = container.querySelector("details")!;
  const toggle = menu.querySelector("summary")!;
  expect(toggle.getAttribute("aria-current")).toBe("page");
  menu.open = true;
  const settings = screen.getByRole("link", { name: "Settings" });
  settings.addEventListener("click", event => event.preventDefault());
  fireEvent.click(settings);
  expect(menu.open).toBe(false);
  menu.open = true;
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(toggle);
});
