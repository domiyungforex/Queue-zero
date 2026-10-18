// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { OnboardingState } from "@/lib/validation/onboarding";

afterEach(cleanup);

const props = {
  requestId: "10000000-0000-4000-8000-000000000001",
  countries: [{ code: "GH", name: "Ghana" }, { code: "NG", name: "Nigeria" }],
  timezones: ["UTC", "Africa/Accra", "Africa/Lagos"],
};
const idle = async (): Promise<OnboardingState> => ({ status: "idle" });

function continueStep() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function reachIndividualDetails(profession = "Lecturer / Teacher") {
  fireEvent.click(screen.getByRole("radio", { name: "Individual" }));
  continueStep();
  fireEvent.click(screen.getByRole("radio", { name: profession }));
  continueStep();
}

function reachIndividualReview() {
  reachIndividualDetails();
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "My Physics Classes" } });
  fireEvent.change(screen.getByLabelText("Teaching level"), { target: { value: "University undergraduate" } });
  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "GH" } });
  fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Accra" } });
  continueStep();
  continueStep();
}

function reachOrganizationDetails(type = "Hospital / Clinic") {
  fireEvent.click(screen.getByRole("radio", { name: "Organization" }));
  continueStep();
  fireEvent.click(screen.getByRole("radio", { name: type }));
  continueStep();
}

function reachOrganizationReview() {
  reachOrganizationDetails();
  fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Greenfield Clinic" } });
  fireEvent.change(screen.getByLabelText("Organization category"), { target: { value: "CLINIC" } });
  fireEvent.change(screen.getByLabelText("Legal organization name"), { target: { value: "Greenfield Clinic Limited" } });
  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "NG" } });
  fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Lagos" } });
  continueStep();
  fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "Main clinic" } });
  fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Lagos" } });
  continueStep();
  fireEvent.click(screen.getByLabelText("Reception"));
  continueStep();
  continueStep();
}

describe("conditional onboarding form", () => {
  it("starts with an accessible account choice and five-step individual default", () => {
    render(<OnboardingForm {...props} action={idle} />);
    expect(screen.getByLabelText("Step 1 of 5: Account")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome to TuRnMaRk" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Individual" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: "Organization" }).getAttribute("aria-checked")).toBe("false");
  });

  it("blocks an incomplete screen with field feedback", () => {
    render(<OnboardingForm {...props} action={idle} />);
    continueStep();
    expect(screen.getByText("Choose individual or organization.")).toBeTruthy();
  });

  it("switches to the seven-step organization path", () => {
    render(<OnboardingForm {...props} action={idle} />);
    fireEvent.click(screen.getByRole("radio", { name: "Organization" }));
    continueStep();
    expect(screen.getByLabelText("Step 2 of 7: Type")).toBeTruthy();
  });

  it("shows every supported profession", () => {
    render(<OnboardingForm {...props} action={idle} />);
    fireEvent.click(screen.getByRole("radio", { name: "Individual" }));
    continueStep();
    for (const profession of ["Lecturer / Teacher", "Doctor", "Nurse", "Banker", "Barber / Stylist", "Consultant", "Other professional"]) {
      expect((screen.getByRole("radio", { name: profession }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("collects supported service and location data for an individual doctor", () => {
    render(<OnboardingForm {...props} action={idle} />);
    reachIndividualDetails("Doctor");
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Dr Ada Consults" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "Consultations" } });
    fireEvent.change(screen.getByLabelText("Authorized practice or service location"), { target: { value: "Authorized practice" } });
    fireEvent.change(screen.getByLabelText("Location address"), { target: { value: "Lagos" } });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "NG" } });
    fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Lagos" } });
    continueStep();
    continueStep();
    expect(screen.getByText("Consultations")).toBeTruthy();
    expect(screen.getByText(/does not represent or verify an employer/i)).toBeTruthy();
  });

  it("preserves individual values while navigating backward", () => {
    render(<OnboardingForm {...props} action={idle} />);
    reachIndividualReview();
    expect(screen.getAllByText("My Physics Classes").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Edit Country" }));
    expect((screen.getByLabelText("Country") as HTMLSelectElement).value).toBe("GH");
    expect((screen.getByLabelText("Timezone") as HTMLSelectElement).value).toBe("Africa/Accra");
  });

  it("collects organization details, location and service templates on separate screens", () => {
    render(<OnboardingForm {...props} action={idle} />);
    reachOrganizationDetails();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Greenfield Clinic" } });
    fireEvent.change(screen.getByLabelText("Organization category"), { target: { value: "CLINIC" } });
    fireEvent.change(screen.getByLabelText("Legal organization name"), { target: { value: "Greenfield Clinic Limited" } });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "NG" } });
    fireEvent.change(screen.getByLabelText("Timezone"), { target: { value: "Africa/Lagos" } });
    continueStep();
    expect(screen.getByLabelText("Location name")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "Main clinic" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Lagos" } });
    continueStep();
    expect(screen.getByLabelText("Reception")).toBeTruthy();
  });

  it("collects a bank representative and category-specific services", () => {
    render(<OnboardingForm {...props} action={idle} />);
    reachOrganizationDetails("Bank / Financial institution");
    expect(screen.getByLabelText("Authorized representative")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "North Finance" } });
    fireEvent.change(screen.getByLabelText("Organization category"), { target: { value: "MICROFINANCE_BANK" } });
    fireEvent.change(screen.getByLabelText("Legal organization name"), { target: { value: "North Finance Limited" } });
    fireEvent.change(screen.getByLabelText("Authorized representative"), { target: { value: "Ada Representative" } });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "NG" } });
    continueStep();
    fireEvent.change(screen.getByLabelText("Location name"), { target: { value: "Central branch" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Lagos" } });
    continueStep();
    expect(screen.getByLabelText("Account opening")).toBeTruthy();
    expect(screen.queryByLabelText("Reception")).toBeNull();
  });

  it("requires an organization authorization declaration before submission", () => {
    render(<OnboardingForm {...props} action={idle} />);
    reachOrganizationReview();
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(screen.getByText("Confirm that you are authorized to register this organization.")).toBeTruthy();
  });

  it("submits preserved values once and shows a pending state", async () => {
    let finish!: (state: OnboardingState) => void;
    const action = vi.fn((previous: OnboardingState, formData: FormData) => {
      void previous;
      void formData;
      return new Promise<OnboardingState>((resolve) => { finish = resolve; });
    });
    render(<OnboardingForm {...props} action={action} />);
    reachIndividualReview();
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    expect((await screen.findByRole("button", { name: "Creating workspace…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
    const submitted = action.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("accountType")).toBe("INDIVIDUAL");
    expect(submitted.get("professionalCategory")).toBe("LECTURER_TEACHER");
    expect(submitted.get("workspaceName")).toBe("My Physics Classes");
    finish({ status: "error", message: "Please try again." });
    await screen.findByRole("alert");
  });

  it("returns to and focuses the invalid field after a server validation error", async () => {
    const action = async (): Promise<OnboardingState> => ({
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: { workspaceName: ["Use a different workspace name."] },
    });
    render(<OnboardingForm {...props} action={action} />);
    reachIndividualReview();
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    const input = await screen.findByLabelText("Workspace display name");
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect((input as HTMLInputElement).value).toBe("My Physics Classes");
    expect(screen.getByText("Use a different workspace name.")).toBeTruthy();
  });
});
