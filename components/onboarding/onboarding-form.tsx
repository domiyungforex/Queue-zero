"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  INDUSTRIES,
  type OnboardingAction,
  type OnboardingField,
  type OnboardingState,
} from "@/lib/validation/onboarding";

const initialState: OnboardingState = { status: "idle" };
const controlClass =
  "onboarding-control";

const steps = [
  { title: "How will you use TuRnMaRk?", hint: "We’ll tailor your workspace around this." },
  { title: "What should we call your organization?", hint: "This appears in your workspace and public queue experience." },
  { title: "What kind of organization is it?", hint: "This helps us choose sensible defaults." },
  { title: "Where are you operating?", hint: "We use this for reporting, dates and local queue times." },
  { title: "Where will your first queue run?", hint: "Add the first place people will arrive." },
] as const;

export function OnboardingForm({
  action,
  countries,
  timezones,
}: {
  action: OnboardingAction;
  countries: { code: string; name: string }[];
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [step, setStep] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedMode, setSelectedMode] = useState("BUSINESS");
  const formRef = useRef<HTMLFormElement>(null);

  const initialTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  useEffect(() => {
    if (state.status !== "error") return;
    if (state.values?.industry) setSelectedIndustry(state.values.industry);
    if (state.values?.organizationMode) setSelectedMode(state.values.organizationMode);
    const field = Object.keys(state.fieldErrors ?? {})[0] as OnboardingField | undefined;
    const fieldStep: Partial<Record<OnboardingField, number>> = {
      businessName: 1,
      industry: 2,
      country: 3,
      timezone: 3,
      locationName: 4,
      locationAddress: 4,
    };
    if (!field || fieldStep[field] === undefined) return;
    const nextStep = fieldStep[field]!;
    const timer = window.setTimeout(() => setStep(nextStep), 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  function nextStep() {
    if (step === 2 && !selectedIndustry) {
      formRef.current?.querySelector<HTMLSelectElement>("#industry")?.focus();
      return;
    }
    setStep((currentStep) => Math.min(steps.length - 1, currentStep + 1));
  }

  function value(name: OnboardingField) {
    return state.values?.[name] ?? "";
  }

  const errorFor = (name: OnboardingField) => state.fieldErrors?.[name]?.[0];

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="onboarding-survey">
      <div className="onboarding-progress" aria-label="Onboarding progress">
        <div>
          <span>Step {step + 1} of {steps.length}</span>
          <strong>{Math.round(((step + 1) / steps.length) * 100)}%</strong>
        </div>
        <div className="onboarding-progress-track">
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <section className="onboarding-card">
        <p className="eyebrow">SET UP YOUR WORKSPACE</p>
        <h2>{steps[step].title}</h2>
        <p className="onboarding-hint">{steps[step].hint}</p>

        {state.status === "error" && (
          <div role="alert" className="onboarding-error">
            {state.message}
          </div>
        )}

        <div className="onboarding-question">
          <div hidden={step !== 0}>
            <div className="choice-grid">
              {[
                ["BUSINESS", "Business", "Customer queues, service desks and branches"],
                ["SCHOOL", "School", "Queues plus class attendance tools"],
                ["HYBRID", "Both", "Customer service and education workflows"],
              ].map(([mode, label, description]) => (
                <label className="choice-card" key={mode}>
                  <input
                    type="radio"
                    name="organizationMode"
                    value={mode}
                    checked={selectedMode === mode}
                    onChange={() => setSelectedMode(mode)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div hidden={step !== 1}>
            <label htmlFor="businessName">Organization name</label>
            <input
              id="businessName"
              name="businessName"
              className={controlClass}
              defaultValue={value("businessName")}
              maxLength={160}
              autoComplete="organization"
              placeholder="e.g. Greenfield Clinic"
              aria-invalid={errorFor("businessName") ? true : undefined}
            />
            {errorFor("businessName") && <p className="field-error">{errorFor("businessName")}</p>}
          </div>

          <div hidden={step !== 2}>
            <label htmlFor="industry">Industry</label>
            <select
              id="industry"
              name="industry"
              className={controlClass}
              value={selectedIndustry}
              onChange={(event) => setSelectedIndustry(event.target.value)}
              aria-invalid={errorFor("industry") ? true : undefined}
            >
              <option value="" disabled>Choose an industry</option>
              {INDUSTRIES.map(({ value: industryValue, label }) => (
                <option key={industryValue} value={industryValue}>{label}</option>
              ))}
            </select>
            {errorFor("industry") && <p className="field-error">{errorFor("industry")}</p>}
          </div>

          <div hidden={step !== 3} className="onboarding-stack">
            <div>
              <label htmlFor="country">Country</label>
              <select
                id="country"
                name="country"
                className={controlClass}
                defaultValue={value("country")}
                autoComplete="country"
                aria-invalid={errorFor("country") ? true : undefined}
              >
                <option value="" disabled>Choose a country</option>
                {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
              </select>
              {errorFor("country") && <p className="field-error">{errorFor("country")}</p>}
            </div>
            <div>
              <label htmlFor="timezone">Timezone</label>
              <select
                id="timezone"
                name="timezone"
                className={controlClass}
                defaultValue={value("timezone") || initialTimezone}
                aria-invalid={errorFor("timezone") ? true : undefined}
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>
                ))}
              </select>
              {errorFor("timezone") && <p className="field-error">{errorFor("timezone")}</p>}
            </div>
          </div>

          <div hidden={step !== 4} className="onboarding-stack">
            <div>
              <label htmlFor="locationName">Location name</label>
              <input
                id="locationName"
                name="locationName"
                className={controlClass}
                defaultValue={value("locationName")}
                maxLength={160}
                placeholder="e.g. Main Branch"
                aria-invalid={errorFor("locationName") ? true : undefined}
              />
              {errorFor("locationName") && <p className="field-error">{errorFor("locationName")}</p>}
            </div>
            <div>
              <label htmlFor="locationAddress">Address</label>
              <textarea
                id="locationAddress"
                name="locationAddress"
                className={controlClass}
                defaultValue={value("locationAddress")}
                rows={3}
                maxLength={500}
                autoComplete="street-address"
                placeholder="Street address, city or town"
                aria-invalid={errorFor("locationAddress") ? true : undefined}
              />
              {errorFor("locationAddress") && <p className="field-error">{errorFor("locationAddress")}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="onboarding-actions">
        <button
          type="button"
          className="button-quiet"
          disabled={pending || step === 0}
          onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
        >
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            className="button-primary"
            onClick={nextStep}
          >
            Continue
          </button>
        ) : (
          <button type="submit" disabled={pending} className="button-primary">
            {pending ? "Creating workspace…" : "Finish setup"}
          </button>
        )}
      </div>

      <p className="onboarding-note">No payment details required. You can change these details later.</p>
    </form>
  );
}
