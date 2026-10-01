// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { PublicTicketView } from "@/components/customer/public-ticket";
import { publicTicketFixture as fixture } from "@/tests/fixtures/public-ticket";
import type { CancelTicketState } from "@/lib/validation/ticket";
afterEach(cleanup);
it("shows the number, position, rounded wait and location-local joined time", () => {
  render(<PublicTicketView ticket={fixture} cancelAction={vi.fn()} />);
  expect(screen.getByText("A014")).toBeTruthy(); expect(screen.getByText("4")).toBeTruthy();
  expect(screen.getByText("About 20–25 min")).toBeTruthy(); expect(screen.getByText(/Oct 1/)).toBeTruthy();
  expect(screen.getByText("Main Branch")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Refresh ticket" })); expect(refresh).toHaveBeenCalledOnce();
});
it.each(["serving", "completed", "no_show", "cancelled"] as const)("renders %s without obsolete waiting position or cancellation", (status) => {
  render(<PublicTicketView ticket={{ ...fixture, status, people_ahead: null, estimated_wait_seconds: null }} cancelAction={vi.fn()} />);
  expect(screen.queryByText("Estimated wait")).toBeNull(); expect(screen.queryByRole("button", { name: "Leave queue" })).toBeNull();
  if (status === "serving") { expect(screen.getByRole("heading", { name: "It’s your turn" })).toBeTruthy(); expect(screen.getByText("Now serving")).toBeTruthy(); }
  else expect(screen.getByRole("link", { name: "View queue" }).getAttribute("href")).toBe(`/q/${fixture.queue_slug}`);
});
it("clarifies zero ahead while another customer is serving", () => {
  render(<PublicTicketView ticket={{ ...fixture, people_ahead: 0, estimated_wait_seconds: 0 }} cancelAction={vi.fn()} />);
  expect(screen.getByText("After the current customer")).toBeTruthy(); expect(screen.getByText(/Wait for staff to call/)).toBeTruthy();
});
it("preserves ticket and cancellation during a pause without promising a wait", () => {
  render(<PublicTicketView ticket={{ ...fixture, queue_status: "paused", estimated_wait_seconds: null }} cancelAction={vi.fn()} />);
  expect(screen.getByText("Queue paused")).toBeTruthy(); expect(screen.getByText("Unavailable right now")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Leave queue" })).toBeTruthy();
});
it("requires confirmation, prevents double submission and shows a retryable failure", async () => {
  let finish!: (state: CancelTicketState) => void;
  const action = vi.fn(() => new Promise<CancelTicketState>((resolve) => { finish = resolve; }));
  render(<PublicTicketView ticket={fixture} cancelAction={action} />);
  fireEvent.click(screen.getByRole("button", { name: "Leave queue" })); expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep my place" })); expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Leave queue" }));
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Yes, leave queue" }).closest("form")!); });
  expect((screen.getByRole("button", { name: "Leaving…" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { finish({ status: "error", message: "Retry cancellation" }); });
  expect(screen.getByRole("alert").textContent).toBe("Retry cancellation");
});
it("renders business controlled strings as text", () => {
  render(<PublicTicketView ticket={{ ...fixture, queue_name: '<script>alert("x")</script>' }} cancelAction={vi.fn()} />);
  expect(screen.getByText('<script>alert("x")</script>')).toBeTruthy(); expect(document.querySelector("script")).toBeNull();
});
