// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DashboardError from "@/app/dashboard/error";

afterEach(cleanup);

describe("dashboard error", () => {
  it("does not send an existing workspace to onboarding", () => {
    render(<DashboardError error={new Error("School records could not be loaded.")} reset={() => undefined} />);
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("link", { name: "Set up workspace" })).toBeNull();
    expect(screen.queryByText(/never finished/)).toBeNull();
  });
});
