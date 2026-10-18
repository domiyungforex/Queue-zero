// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WelcomeBackShell } from "@/components/auth/welcome-back-shell";

afterEach(cleanup);

describe("Welcome Back sign-in shell", () => {
  it("keeps marketing artwork separate from the functional sign-in controls", () => {
    render(<WelcomeBackShell><form aria-label="Clerk sign-in"><input aria-label="Email address" /></form></WelcomeBackShell>);

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "Clerk sign-in" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "TuRnMaRk receptionist working at a laptop" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "TuRnMaRk student carrying school books" }).getAttribute("src"))
      .toContain("welcome-student.png");
    expect(screen.getByText("Queues. Attendance.", { exact: false })).toBeTruthy();
    expect(screen.getByText("Illustrative product scenario")).toBeTruthy();
    expect(screen.getByText("Designed for schools, hospitals,", { exact: false })).toBeTruthy();
  });
});
