// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Brand } from "@/components/ui/brand";
import {
  IndustryIllustration,
  IndustrySelectionCard,
  ResponsiveNavigation,
  StatusIndicator,
} from "@/components/ui/turnmark-system";

afterEach(cleanup);

describe("TuRnMaRk shared design system", () => {
  it("uses the approved symbol and wordmark in an accessible home link", () => {
    render(<Brand />);

    const brand = screen.getByRole("link", { name: "TuRnMaRk home" });
    expect(brand.getAttribute("href")).toBe("/");
    const sources = Array.from(brand.querySelectorAll("img")).map((image) => image.getAttribute("src"));
    expect(sources.some((source) => source?.includes("brand_symbol.png"))).toBe(true);
    expect(sources.some((source) => source?.includes("brand_wordmark.png"))).toBe(true);
  });

  it("keeps selection cards keyboard-addressable and form-compatible", () => {
    render(
      <IndustrySelectionCard
        industry="education"
        title="University / School"
        description="Attendance and campus services"
        name="industry"
        value="education"
        defaultChecked
      />,
    );

    const option = screen.getByRole("radio", { name: /University \/ School/i });
    expect(option.getAttribute("name")).toBe("industry");
    expect((option as HTMLInputElement).checked).toBe(true);
  });

  it("provides meaningful alternative text for approved industry artwork", () => {
    render(<IndustryIllustration industry="healthcare" />);
    expect(screen.getByRole("img", { name: "Hospital building" })).toBeTruthy();
  });

  it("renders matching desktop and mobile navigation destinations", () => {
    render(
      <ResponsiveNavigation
        items={[{ href: "/features", label: "Features" }, { href: "/pricing", label: "Pricing" }]}
        secondaryAction={{ href: "/sign-in", label: "Sign in" }}
        primaryAction={{ href: "/sign-up", label: "Get started" }}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Features" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Pricing" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeTruthy();
  });

  it("announces status labels without relying on color alone", () => {
    render(<StatusIndicator label="Awaiting review" tone="pending" />);
    expect(screen.getByText("Awaiting review")).toBeTruthy();
  });
});
