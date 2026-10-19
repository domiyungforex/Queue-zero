// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: null }) }));
vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => {
    void _fill;
    void _priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

import Home from "@/app/(marketing)/page";

afterEach(cleanup);

describe("TuRnMaRk marketing home", () => {
  it("leads with one queue-first heading and clear calls to action", async () => {
    render(await Home());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /People flow better with TuRnMaRk/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Get started/i }).some((link) => link.getAttribute("href") === "/sign-up")).toBe(true);
    expect(screen.getByRole("link", { name: /See how it works/i }).getAttribute("href")).toBe("#how-it-works");
    expect(screen.getByText(/No download or customer account required/i)).toBeTruthy();
  });

  it("uses approved artwork with useful alternative text", async () => {
    render(await Home());

    expect(screen.getByRole("img", { name: /customer using TuRnMaRk at a reception desk/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /customer phone beside a TuRnMaRk queue workspace/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: "School building" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Healthcare professional" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Government service building" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Business professional holding a tablet" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Student holding a tablet" })).toBeTruthy();
  });

  it("does not present reference-image statistics or fabricated endorsements", async () => {
    render(await Home());

    for (const claim of ["500K+", "2,500+", "99.9%", "Trusted by modern organizations"]) {
      expect(screen.queryByText(claim)).toBeNull();
    }
    expect(screen.getByText(/We only publish customer results and reviews with permission/i)).toBeTruthy();
  });

  it("keeps core internal destinations available in desktop and mobile navigation", async () => {
    render(await Home());

    expect(screen.getAllByRole("link", { name: "Pricing" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Sign in" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Contact" }).length).toBeGreaterThanOrEqual(2);
  });
});
