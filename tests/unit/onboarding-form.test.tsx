// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { OnboardingState, OnboardingValues } from "@/lib/validation/onboarding";

afterEach(cleanup);
const props = { countries: [{ code: "GH", name: "Ghana" }], timezones: ["UTC", "Africa/Accra"] };
const values: OnboardingValues = { businessName: "Clinic A", industry: "healthcare", country: "GH", timezone: "Africa/Accra", locationName: "Main", locationAddress: "Accra" };

function fillForm() {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(document.getElementById(name)!, { target: { value } });
  }
  return screen.getByRole("button", { name: "Create business" }).closest("form")!;
}

describe("onboarding form", () => {
  it("labels all six required fields", () => {
    render(<OnboardingForm {...props} action={async () => ({ status: "idle" })} />);
    for (const label of ["Business name", "Industry", "Country", "Timezone", "Location name", "Location address"]) {
      expect(screen.getByLabelText(label).hasAttribute("required")).toBe(true);
    }
  });

  it("disables submission and shows progress while saving", async () => {
    let finish!: (state: OnboardingState) => void;
    const action = vi.fn(() => new Promise<OnboardingState>((resolve) => { finish = resolve; }));
    render(<OnboardingForm {...props} action={action} />);
    fireEvent.submit(fillForm());
    const button = await screen.findByRole("button", { name: "Creating your business…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector("fieldset")?.disabled).toBe(true);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish({ status: "error", message: "Please try again.", values }));
    expect((screen.getByRole("button", { name: "Create business" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps values after server errors and focuses the invalid field", async () => {
    const action = async (): Promise<OnboardingState> => ({ status: "error", values, message: "Please check the highlighted fields.", fieldErrors: { businessName: ["Use a different name."] } });
    render(<OnboardingForm {...props} action={action} />);
    fireEvent.submit(fillForm());
    await screen.findByRole("alert");
    const name = screen.getByLabelText("Business name") as HTMLInputElement;
    await waitFor(() => expect(name.getAttribute("aria-invalid")).toBe("true"));
    expect(name.value).toBe("Clinic A");
    expect((screen.getByLabelText("Location address") as HTMLTextAreaElement).value).toBe("Accra");
    expect((screen.getByLabelText("Country") as HTMLSelectElement).value).toBe("GH");
    expect(document.activeElement).toBe(name);
    expect(screen.getByText("Use a different name.").id).toBe(name.getAttribute("aria-describedby"));
  });
});
