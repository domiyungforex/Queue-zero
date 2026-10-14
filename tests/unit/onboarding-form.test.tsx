// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { OnboardingState } from "@/lib/validation/onboarding";

afterEach(cleanup);
const props = { requestId: "10000000-0000-4000-8000-000000000001", countries: [{ code: "GH", name: "Ghana" }, { code: "NG", name: "Nigeria" }], timezones: ["UTC", "Africa/Accra", "Africa/Lagos"] };
const idle = async (): Promise<OnboardingState> => ({ status: "idle" });

function continueStep() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function reachIndividualReview() {
  fireEvent.click(screen.getByRole("radio", { name: /Individual/ }));
  continueStep();
  fireEvent.click(screen.getByRole("radio", { name: "Lecturer / Teacher" }));
  continueStep();
  fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "My Physics Classes" } });
  fireEvent.change(screen.getByLabelText("Teaching level"), { target: { value: "University undergraduate" } });
  continueStep();
  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "GH" } });
  fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Accra" } });
  continueStep();
}

describe("unified onboarding form", () => {
  it("starts with an accessible six-step account choice", () => {
    render(<OnboardingForm {...props} action={idle} />);
    expect(screen.getByText("Step 1 of 6")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Individual/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: /Organization/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText(/sign in|authenticate/i)).toBeNull();
  });

  it("blocks incomplete steps with clear field feedback", () => {
    render(<OnboardingForm {...props} action={idle} />);
    continueStep();
    expect(screen.getByText("Choose individual or organization.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 6")).toBeTruthy();
  });

  it("shows and enables every supported profession", () => {
    render(<OnboardingForm {...props} action={idle} />);
    fireEvent.click(screen.getByRole("radio", { name: /Individual/ }));
    continueStep();
    for (const profession of ["Lecturer / Teacher", "Doctor", "Nurse", "Banker", "Barber / Stylist", "Consultant", "Other professional"]) {
      expect(screen.getByRole("radio", { name: new RegExp(profession.replace("/", "\\/"), "i") })).toBeTruthy();
    }
    expect((screen.getByRole("radio", { name: /Doctor/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("radio", { name: "Lecturer / Teacher" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("collects a persisted service and practice location for a doctor", () => {
    render(<OnboardingForm {...props} action={idle} />);
    fireEvent.click(screen.getByRole("radio", { name: /Individual/ }));
    continueStep();
    fireEvent.click(screen.getByRole("radio", { name: "Doctor" }));
    continueStep();
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Dr Ada Consults" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "Consultations" } });
    continueStep();
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "NG" } });
    fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Lagos" } });
    fireEvent.change(screen.getByLabelText("Authorized practice or service location"), { target: { value: "Authorized practice" } });
    fireEvent.change(screen.getByLabelText("Location address"), { target: { value: "Lagos" } });
    continueStep();
    expect(screen.getByText("Consultations")).toBeTruthy();
    expect(screen.getByText("Authorized practice")).toBeTruthy();
    expect(screen.getByText(/does not represent your employer/i)).toBeTruthy();
  });

  it("preserves individual values across Back and reaches review", () => {
    render(<OnboardingForm {...props} action={idle} />);
    reachIndividualReview();
    expect(screen.getByText("My Physics Classes")).toBeTruthy();
    expect(screen.getByText("Lecturer / Teacher")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect((screen.getByLabelText("Country") as HTMLSelectElement).value).toBe("GH");
    expect((screen.getByLabelText("Timezone") as HTMLSelectElement).value).toBe("Africa/Accra");
  });

  it("collects organization type and required first-location details", () => {
    render(<OnboardingForm {...props} action={idle} />);
    fireEvent.click(screen.getByRole("radio", { name: /Organization/ }));
    continueStep();
    for (const type of ["University / School", "Hospital / Clinic", "Bank / Financial institution", "Salon / Barbershop", "Government office", "Company / Other"]) {
      expect((screen.getByRole("radio", { name: type }) as HTMLButtonElement).disabled).toBe(false);
    }
    fireEvent.click(screen.getByRole("radio", { name: "Hospital / Clinic" }));
    continueStep();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Greenfield Clinic" } });
    fireEvent.change(screen.getByLabelText("Legal organization name"), { target: { value: "Greenfield Clinic Limited" } });
    fireEvent.change(screen.getByLabelText("Organization type"), { target: { value: "CLINIC" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Reception" }));
    continueStep();
    expect(screen.getByLabelText("First location name")).toBeTruthy();
    expect(screen.getByLabelText("Location address")).toBeTruthy();
  });

  it("requires bank affiliation details and explains verification before activation", () => {
    render(<OnboardingForm {...props} action={idle} />);
    fireEvent.click(screen.getByRole("radio", { name: /Organization/ }));
    continueStep();
    fireEvent.click(screen.getByRole("radio", { name: "Bank / Financial institution" }));
    continueStep();
    expect(screen.getByLabelText("Authorized representative")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Account opening" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "North Finance" } });
    fireEvent.change(screen.getByLabelText("Legal organization name"), { target: { value: "North Finance Limited" } });
    fireEvent.change(screen.getByLabelText("Organization type"), { target: { value: "MICROFINANCE_BANK" } });
    fireEvent.change(screen.getByLabelText("Authorized representative"), { target: { value: "Ada Representative" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Customer service" }));
    continueStep();
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "NG" } });
    fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Lagos" } });
    fireEvent.change(screen.getByLabelText("First location name"), { target: { value: "Central branch" } });
    fireEvent.change(screen.getByLabelText("Location address"), { target: { value: "Lagos" } });
    continueStep();
    expect(screen.getByText(/activation remains paused until institutional verification/i)).toBeTruthy();
  });

  it("submits preserved values and shows a loading state", async () => {
    let finish!: (state: OnboardingState) => void;
    const action = vi.fn((previous: OnboardingState, formData: FormData) => {
      void previous;
      void formData;
      return new Promise<OnboardingState>((resolve) => { finish = resolve; });
    });
    render(<OnboardingForm {...props} action={action} />);
    reachIndividualReview();
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect((await screen.findByRole("button", { name: "Creating your workspace…" }) as HTMLButtonElement).disabled).toBe(true);
    const submitted = action.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("accountType")).toBe("INDIVIDUAL");
    expect(submitted.get("onboardingRequestId")).toBe(props.requestId);
    expect(submitted.get("professionalCategory")).toBe("LECTURER_TEACHER");
    expect(submitted.get("workspaceName")).toBe("My Physics Classes");
    expect(submitted.get("teachingLevel")).toBe("University undergraduate");
    finish({ status: "error", message: "Please try again." });
    await screen.findByRole("alert");
  });

  it("returns to the invalid field after a server validation error", async () => {
    const action = async (): Promise<OnboardingState> => ({
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: { workspaceName: ["Use a different workspace name."] },
    });
    render(<OnboardingForm {...props} action={action} />);
    reachIndividualReview();
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    const input = await screen.findByLabelText("Workspace name");
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect((input as HTMLInputElement).value).toBe("My Physics Classes");
    expect(screen.getByText("Use a different workspace name.")).toBeTruthy();
  });

  it("uses narrow-safe containers and stacked mobile actions", () => {
    render(<OnboardingForm {...props} action={idle} />);
    const form = screen.getByRole("button", { name: "Continue" }).closest("form")!;
    expect(form.className).toContain("min-w-0");
    expect(screen.getByRole("button", { name: "Continue" }).parentElement?.className).toContain("flex-col-reverse");
  });
});
