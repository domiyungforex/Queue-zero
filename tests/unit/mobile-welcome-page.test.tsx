// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: null }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import WelcomePage from "@/app/(auth)/welcome/page";

describe("mobile welcome screen", () => {
  it("uses the approved content and connects the two authentication paths", async () => {
    render(await WelcomePage());

    expect(screen.getByRole("heading", { name: "People flow better with TuRnMaRk." })).toBeTruthy();
    expect(screen.getByRole("img", { name: "TuRnMaRk receptionist working at a laptop" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip" }).getAttribute("href")).toBe("/sign-in");
    expect(screen.getByRole("link", { name: /Get started/ }).getAttribute("href")).toBe("/sign-up");
    expect(screen.getByText("Save Time")).toBeTruthy();
    expect(screen.getByText("Better Experience")).toBeTruthy();
    expect(screen.getByText("More Productivity")).toBeTruthy();
  });
});
