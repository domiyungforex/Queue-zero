// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerk.userId }) }));

import Home from "@/app/(marketing)/page";

afterEach(() => {
  cleanup();
  clerk.userId = null;
});

describe("marketing authentication actions", () => {
  it("shows account creation actions to signed-out visitors", async () => {
    render(await Home());
    expect(screen.getAllByRole("link", { name: /Get started/i }).some((link) => link.getAttribute("href") === "/sign-up")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Sign in" }).every((link) => link.getAttribute("href") === "/sign-in")).toBe(true);
  });

  it("replaces sign-up actions with dashboard and queue creation for signed-in users", async () => {
    clerk.userId = "user_signed_in";
    render(await Home());
    expect(screen.getAllByRole("link", { name: /Go to dashboard/i }).every((link) => link.getAttribute("href") === "/dashboard")).toBe(true);
    expect(screen.getAllByRole("link", { name: /Create queue/i }).every((link) => link.getAttribute("href") === "/dashboard/queues/new")).toBe(true);
    expect(screen.queryByRole("link", { name: /Get started/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
