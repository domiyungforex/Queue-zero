// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({ default: ({ unoptimized, ...props }: ComponentProps<"img"> & { unoptimized?: boolean }) => {
  void unoptimized;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt} />;
} }));
import { PublicQueueView } from "@/components/customer/public-queue";
import PublicQueueError from "@/app/(public)/q/[slug]/error";
import PublicQueueNotFound from "@/app/(public)/q/[slug]/not-found";
import { publicQueueFixture as fixture } from "@/tests/fixtures/public-queue";
afterEach(cleanup);

describe("public queue experience", () => {
  it("shows public service details and real queue metrics without account controls", () => {
    render(<PublicQueueView queue={fixture} />);
    expect(screen.getByRole("heading", { level: 1, name: fixture.queue_name })).toBeTruthy();
    expect(screen.getByText(fixture.business_name)).toBeTruthy();
    expect(screen.getByText(fixture.location_name)).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("About 20–25 min")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in|sign up|dashboard/i })).toBeNull();
    expect(screen.getByText("No app. No account.")).toBeTruthy();
  });
  it("links open queues to the anonymous join form", () => {
    render(<PublicQueueView queue={fixture} />);
    const join = screen.getByRole("link", { name: "Join queue" });
    expect(join.getAttribute("href")).toBe(`/q/${fixture.slug}/join`);
    expect(join.getAttribute("aria-describedby")).toBe("join-availability");
    expect(screen.getByText(/No download. No account./)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it.each(["paused", "closed"] as const)("displays %s without a join promise or misleading estimate", (status) => {
    render(<PublicQueueView queue={{ ...fixture, status, estimated_wait_seconds: null }} />);
    expect((screen.getByRole("button", { name: `Queue ${status}` }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Not available right now")).toBeTruthy();
    expect(screen.queryByText(/About .* min/)).toBeNull();
  });
  it("handles an empty queue and a singular waiting customer", () => {
    const { rerender } = render(<PublicQueueView queue={{ ...fixture, waiting_count: 0, estimated_wait_seconds: 0, has_serving_customer: false }} />);
    expect(screen.getByText("No one is waiting right now.")).toBeTruthy();
    expect(screen.getByText("No wait expected")).toBeTruthy();
    rerender(<PublicQueueView queue={{ ...fixture, waiting_count: 1 }} />);
    expect(screen.getByText("person currently waiting")).toBeTruthy();
  });
  it("renders business-controlled text without interpreting markup", () => {
    render(<PublicQueueView queue={{ ...fixture, description: '<script>alert("x")</script>', business_name: '<img src=x onerror="alert(1)">' }} />);
    expect(screen.getByText('<script>alert("x")</script>')).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
  it("loads a logo without referrer data and falls back on failure", () => {
    render(<PublicQueueView queue={{ ...fixture, business_logo_url: "https://example.com/logo.png" }} />);
    const logo = screen.getByRole("img", { name: `${fixture.business_name} logo` });
    expect(logo.getAttribute("referrerpolicy")).toBe("no-referrer");
    fireEvent.error(logo);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(fixture.business_name)).toBeTruthy();
  });
  it("refreshes authoritative queue data on request", () => {
    render(<PublicQueueView queue={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh queue" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("offers a retry on failure and never displays raw provider errors", () => {
    const reset = vi.fn();
    render(<PublicQueueError error={new Error("PRIVATE_PROVIDER_DETAIL")} reset={reset} />);
    expect(screen.queryByText("PRIVATE_PROVIDER_DETAIL")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
  it("makes an unavailable queue understandable without exposing a slug or account flow", () => {
    render(<PublicQueueNotFound />);
    expect(screen.getByRole("heading", { name: "Queue unavailable" })).toBeTruthy();
    expect(screen.getByText(/ask staff for the current queue QR code/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });
});
