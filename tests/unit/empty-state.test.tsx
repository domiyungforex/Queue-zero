// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";

describe("EmptyState", () => {
  it("supports relevant artwork and primary and secondary actions", () => {
    render(<EmptyState title="No queues yet" description="Create the first service queue." href="/dashboard/queues/new" label="Create queue" secondaryHref="/how-it-works" secondaryLabel="Learn how queues work" illustration={TURNMARK_ASSETS.illustrations.waitingChairs} />);

    expect(screen.getByRole("img", { name: "Waiting-room chairs" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Create queue/i }).getAttribute("href")).toBe("/dashboard/queues/new");
    expect(screen.getByRole("link", { name: "Learn how queues work" }).getAttribute("href")).toBe("/how-it-works");
  });
});
