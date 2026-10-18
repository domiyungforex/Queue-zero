// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PersonalOverviewMobile, PersonalQueuesMobile, PersonalServicesMobile } from "@/components/professional/personal-workspace-mobile";
import type { BusinessMetrics } from "@/lib/validation/operations";

const metrics: BusinessMetrics = {
  timezone: "Africa/Lagos",
  days: 7,
  waiting: 2,
  serving: 1,
  joins: 8,
  joins_today: 3,
  completed: 5,
  completed_today: 4,
  no_shows: 0,
  cancelled: 0,
  average_wait_seconds: 720,
  average_service_seconds: 600,
  daily: [],
  hourly: [],
};

const queues = [{
  id: "queue-a",
  name: "Consultation",
  description: null,
  status: "open" as const,
  average_service_seconds: 600,
  locations: { name: "Main practice" },
}];

afterEach(cleanup);

describe("personal workspace mobile views", () => {
  it("renders real overview metrics and the existing queue creation route", () => {
    render(<PersonalOverviewMobile queues={queues} metrics={metrics} customerCount={14} canManage />);
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("12 min")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Create queue/i })[0].getAttribute("href")).toBe("/dashboard/queues/new");
    expect(screen.getByRole("link", { name: /View queue\s*Consultation/i }).getAttribute("href")).toBe("/dashboard/queues/queue-a");
  });

  it("keeps the saved service separate from queue creation", () => {
    render(<PersonalServicesMobile profile={{ service_name: "Consultation", locations: { name: "Lagos", address: "Ikeja" } }} fallbackLabel="Professional service" canManage />);
    expect(screen.getByRole("heading", { name: "Consultation" })).toBeTruthy();
    expect(screen.getByText("Lagos · Ikeja")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Create queue/i }).getAttribute("href")).toBe("/dashboard/queues/new");
  });

  it("maps archived to the real closed state and filters queue cards", () => {
    const closed = { ...queues[0], id: "queue-b", name: "Past queue", status: "closed" as const };
    render(<PersonalQueuesMobile queues={[...queues, closed]} metrics={metrics} canManage activeFilter="closed" />);
    expect(screen.getByRole("link", { name: "Archived" }).getAttribute("href")).toBe("/dashboard/queues?status=closed");
    expect(screen.getByRole("heading", { name: "Past queue" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Consultation" })).toBeNull();
  });

  it("shows section-level failures without inventing zero values", () => {
    render(<PersonalOverviewMobile queues={[]} metrics={null} customerCount={null} canManage queueError metricError />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("We couldn’t load your queues.")).toBeTruthy();
    expect(screen.queryByText("No queues yet")).toBeNull();
  });
});
