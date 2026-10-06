// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { OnboardingState } from "@/lib/validation/onboarding";

afterEach(cleanup);
const props = { countries: [{ code: "GH", name: "Ghana" }], timezones: ["UTC", "Africa/Accra"] };
function next() { fireEvent.click(screen.getByRole("button", { name: "Continue" })); }
function fillAll() {
  next();
  fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Clinic A" } });
  next();
  fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "healthcare" } });
  next();
  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "GH" } });
  fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Accra" } });
  next();
  fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "Main" } });
  fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Accra" } });
}
describe("onboarding form", () => {
  it("moves through the five setup steps with accessible fields", () => {
    render(<OnboardingForm {...props} action={async () => ({ status: "idle" })} />);
    expect(screen.getByRole("heading", { name: /How will you use TuRnMaRk/ })).toBeTruthy();
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    next(); expect(screen.getByLabelText("Organization name")).toBeTruthy();
    next(); expect(screen.getByLabelText("Industry")).toBeTruthy();
    next(); expect(screen.getByLabelText("Country")).toBeTruthy(); expect(screen.getByLabelText("Timezone")).toBeTruthy();
    next(); expect(screen.getByLabelText("Location name")).toBeTruthy(); expect(screen.getByLabelText("Address")).toBeTruthy();
  });
  it("disables final submission and shows progress while saving", async () => {
    let finish!: (state: OnboardingState) => void;
    const action = vi.fn(() => new Promise<OnboardingState>((resolve) => { finish = resolve; }));
    render(<OnboardingForm {...props} action={action} />);
    fillAll();
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    const button = await screen.findByRole("button", { name: "Creating workspace…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish({ status: "error", message: "Please try again." }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
  it("returns to the step containing a server-invalid field and keeps its value", async () => {
    const action = async (): Promise<OnboardingState> => ({
      status: "error", message: "Please check the highlighted fields.",
      values: { organizationMode: "BUSINESS", businessName: "Clinic A", industry: "healthcare", country: "GH", timezone: "Africa/Accra", locationName: "Main", locationAddress: "Accra" },
      fieldErrors: { businessName: ["Use a different name."] },
    });
    render(<OnboardingForm {...props} action={action} />);
    fillAll();
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(screen.getByLabelText("Organization name")).toBeTruthy());
    const name = screen.getByLabelText("Organization name") as HTMLInputElement;
    expect(name.value).toBe("Clinic A");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Use a different name.")).toBeTruthy();
  });
});
