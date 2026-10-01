"use client";

import { useActionState, useEffect, useRef } from "react";
import { INDUSTRIES, type OnboardingAction, type OnboardingField, type OnboardingState } from "@/lib/validation/onboarding";

const initialState: OnboardingState = { status: "idle" };
const controlClass = "mt-2 min-h-12 w-full rounded-lg border border-black/20 bg-white px-3 py-3 text-base text-foreground disabled:bg-black/5 aria-invalid:border-red-700";

function Field({ name, label, error, children }: {
  name: OnboardingField;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="block text-sm font-semibold">{label}</label>
      {children}
      {error && <p id={`${name}-error`} className="mt-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}

export function OnboardingForm({ action, countries, timezones }: {
  action: OnboardingAction;
  countries: { code: string; name: string }[];
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?? formRef.current?.querySelector<HTMLElement>('[role="alert"]');
      target?.focus();
    }
  }, [state]);

  function inputProps(name: OnboardingField) {
    return {
      id: name,
      name,
      required: true,
      defaultValue: state.values?.[name] ?? (name === "timezone" ? "UTC" : ""),
      "aria-invalid": state.fieldErrors?.[name]?.length ? true : undefined,
      "aria-describedby": state.fieldErrors?.[name]?.length ? `${name}-error` : undefined,
      className: controlClass,
    };
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="max-w-3xl space-y-6">
      {state.status === "error" && (
        <div role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          {state.message}
        </div>
      )}
      <fieldset disabled={pending} className="rounded-2xl border border-black/10 bg-white p-5 sm:p-8">
        <legend className="sr-only">Business and first location details</legend>
        <h2 className="text-xl font-semibold">About your business</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">A few details to make this workspace yours. All fields are required.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="businessName" label="Business name" error={state.fieldErrors?.businessName?.[0]}>
              <input {...inputProps("businessName")} maxLength={160} autoComplete="organization" placeholder="e.g. Greenfield Clinic" />
            </Field>
          </div>
          <Field name="industry" label="Industry" error={state.fieldErrors?.industry?.[0]}>
            <select key={state.values?.industry ?? "industry"} {...inputProps("industry")}>
              <option value="" disabled>Choose an industry</option>
              {INDUSTRIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field name="country" label="Country" error={state.fieldErrors?.country?.[0]}>
            <select key={state.values?.country ?? "country"} {...inputProps("country")} autoComplete="country">
              <option value="" disabled>Choose a country</option>
              {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field name="timezone" label="Timezone" error={state.fieldErrors?.timezone?.[0]}>
              <select key={state.values?.timezone ?? "timezone"} {...inputProps("timezone")}>
                {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
            <p className="mt-2 text-sm text-muted">Choose the timezone where your first location operates.</p>
          </div>
        </div>
        <div className="my-8 border-t border-black/10" />
        <h2 className="text-xl font-semibold">Your first location</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Where will your customers visit?</p>
        <div className="mt-6 grid gap-5">
          <Field name="locationName" label="Location name" error={state.fieldErrors?.locationName?.[0]}>
            <input {...inputProps("locationName")} maxLength={160} placeholder="e.g. Main Branch" />
          </Field>
          <Field name="locationAddress" label="Location address" error={state.fieldErrors?.locationAddress?.[0]}>
            <textarea {...inputProps("locationAddress")} rows={3} maxLength={500} autoComplete="street-address" placeholder="Street address, city or town" />
          </Field>
        </div>
      </fieldset>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-sm leading-relaxed text-muted">Start on the free plan. No payment details needed.</p>
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-primary px-7 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">
          {pending ? "Creating your business…" : "Create business"}
        </button>
      </div>
      <p role="status" className="sr-only">{pending ? "Saving your business and location. Please wait." : ""}</p>
    </form>
  );
}
