"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ACCOUNT_TYPES,
  ONBOARDING_FIELDS,
  ORGANIZATION_TYPES,
  PROFESSIONS,
  type OnboardingAction,
  type OnboardingField,
  type OnboardingState,
  type OnboardingValues,
} from "@/lib/validation/onboarding";

const initialState: OnboardingState = { status: "idle" };
const initialValues: OnboardingValues = {
  onboardingRequestId: "",
  accountType: "",
  professionalCategory: "",
  organizationType: "",
  workspaceName: "",
  teachingLevel: "",
  institutionName: "",
  serviceName: "",
  country: "",
  timezone: "UTC",
  locationName: "",
  locationAddress: "",
};
const stepNames = ["Welcome", "Type", "Details", "Configure", "Review", "Complete"] as const;
const fieldSteps: Record<OnboardingField, number> = {
  onboardingRequestId: 0,
  accountType: 0,
  professionalCategory: 1,
  organizationType: 1,
  workspaceName: 2,
  teachingLevel: 2,
  institutionName: 2,
  serviceName: 2,
  country: 3,
  timezone: 3,
  locationName: 3,
  locationAddress: 3,
};
const controlClass = "mt-2 min-h-12 min-w-0 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-foreground shadow-sm aria-invalid:border-red-700 aria-invalid:ring-1 aria-invalid:ring-red-700";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={`${id}-error`} className="mt-2 text-sm font-medium text-red-800">{message}</p> : null;
}

export function OnboardingForm({ action, countries, timezones, requestId }: {
  action: OnboardingAction;
  countries: { code: string; name: string }[];
  timezones: string[];
  requestId: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<OnboardingValues>({ ...initialValues, onboardingRequestId: requestId });
  const [clientErrors, setClientErrors] = useState<Partial<Record<OnboardingField, string>>>({});
  async function submitAction(previous: OnboardingState, formData: FormData) {
    const result = await action(previous, formData);
    const firstField = ONBOARDING_FIELDS.find((field) => result.fieldErrors?.[field]?.length);
    if (firstField) setStep(fieldSteps[firstField]);
    return result;
  }
  const [state, formAction, pending] = useActionState(submitAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = { ...Object.fromEntries(Object.entries(state.fieldErrors ?? {}).map(([field, messages]) => [field, messages?.[0]])), ...clientErrors };
  const isIndividual = values.accountType === "INDIVIDUAL";
  const isLecturer = isIndividual && values.professionalCategory === "LECTURER_TEACHER";
  const isProfessionalService = isIndividual && Boolean(values.professionalCategory) && !isLecturer;
  const needsLocation = !isIndividual || isProfessionalService;

  useEffect(() => {
    if (state.status !== "error") return;
    requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?? formRef.current?.querySelector<HTMLElement>('[role="alert"]');
      target?.focus();
    });
  }, [state]);

  function update(field: OnboardingField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setClientErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function selectAccount(accountType: (typeof ACCOUNT_TYPES)[number]) {
    setValues((current) => ({
      ...current,
      accountType,
      professionalCategory: accountType === "INDIVIDUAL" ? current.professionalCategory : "",
      organizationType: accountType === "ORGANIZATION" ? current.organizationType : "",
      teachingLevel: accountType === "INDIVIDUAL" ? current.teachingLevel : "",
      institutionName: accountType === "INDIVIDUAL" ? current.institutionName : "",
      serviceName: accountType === "INDIVIDUAL" ? current.serviceName : "",
    }));
    setClientErrors({});
  }

  function selectProfession(professionalCategory: string) {
    const lecturer = professionalCategory === "LECTURER_TEACHER";
    setValues((current) => ({
      ...current,
      professionalCategory,
      teachingLevel: lecturer ? current.teachingLevel : "",
      institutionName: lecturer ? current.institutionName : "",
      serviceName: lecturer ? "" : current.serviceName,
      locationName: lecturer ? "" : current.locationName,
      locationAddress: lecturer ? "" : current.locationAddress,
    }));
    setClientErrors({});
  }

  function validateCurrentStep() {
    const nextErrors: Partial<Record<OnboardingField, string>> = {};
    if (step === 0 && !values.accountType) nextErrors.accountType = "Choose individual or organization.";
    if (step === 1 && isIndividual && !values.professionalCategory) nextErrors.professionalCategory = "Choose an available profession.";
    if (step === 1 && !isIndividual && !values.organizationType) nextErrors.organizationType = "Choose an organization type.";
    if (step === 2) {
      if (!values.workspaceName.trim()) nextErrors.workspaceName = "Workspace name is required.";
      if (isLecturer && !values.teachingLevel.trim()) nextErrors.teachingLevel = "Teaching level is required.";
      if (isProfessionalService && !values.serviceName.trim()) nextErrors.serviceName = "Service name is required.";
    }
    if (step === 3) {
      if (!values.country) nextErrors.country = "Choose a country.";
      if (!values.timezone) nextErrors.timezone = "Choose a timezone.";
      if (needsLocation && !values.locationName.trim()) nextErrors.locationName = "Location name is required.";
      if (needsLocation && !values.locationAddress.trim()) nextErrors.locationAddress = "Location address is required.";
    }
    setClientErrors(nextErrors);
    const firstField = ONBOARDING_FIELDS.find((field) => nextErrors[field]);
    if (firstField) {
      requestAnimationFrame(() => document.getElementById(firstField)?.focus());
      return false;
    }
    return true;
  }

  function continueToNextStep() {
    if (validateCurrentStep()) setStep((current) => Math.min(current + 1, 4));
  }

  const organization = ORGANIZATION_TYPES.find(({ value }) => value === values.organizationType);
  const profession = PROFESSIONS.find(({ value }) => value === values.professionalCategory);
  const accountLabel = isIndividual ? "Individual" : "Organization";

  return (
    <form ref={formRef} action={formAction} onReset={(event) => event.preventDefault()} aria-busy={pending} className="min-w-0 w-full max-w-4xl overflow-hidden rounded-3xl border border-black/10 bg-[#fffef9] shadow-[0_24px_70px_rgba(2,35,28,0.08)]">
      {ONBOARDING_FIELDS.map((field) => <input key={field} type="hidden" name={field} value={values[field]} />)}
      <div className="bg-[#062f29] px-5 py-6 text-white sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c6ef67]">Step {step + 1} of 6</p><p className="mt-2 text-sm text-white/75">A workspace shaped around how you work.</p></div>
          <span className="text-sm font-semibold text-[#c6ef67]">{Math.round(((step + 1) / 6) * 100)}%</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-[#b9ee57] transition-[width]" style={{ width: `${((step + 1) / 6) * 100}%` }} /></div>
        <ol aria-label="Onboarding progress" className="mt-4 flex gap-2 overflow-x-auto pb-1 text-[11px] text-white/55">
          {stepNames.map((name, index) => <li key={name} aria-current={index === step ? "step" : undefined} className={`shrink-0 ${index === step ? "font-bold text-white" : ""}`}>{index + 1}. {name}</li>)}
        </ol>
      </div>

      <fieldset disabled={pending} className="min-w-0 p-5 sm:p-8 lg:p-10">
        <legend className="sr-only">TuRnMaRk workspace onboarding</legend>
        {state.status === "error" && <div role="alert" tabIndex={-1} className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{state.message}</div>}

        {step === 0 && <section aria-labelledby="onboarding-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008f4c]">Welcome to TuRnMaRk</p>
          <h2 id="onboarding-step-title" className="mt-3 text-3xl font-semibold text-[#071f1b] sm:text-4xl">Who is this workspace for?</h2>
          <p className="mt-3 max-w-2xl leading-7 text-muted">Choose the option that reflects who owns the work. You can still belong to other TuRnMaRk organizations later.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-describedby={errors.accountType ? "accountType-error" : undefined}>
            {[
              { value: "INDIVIDUAL", title: "Individual", description: "I want to manage my own work." },
              { value: "ORGANIZATION", title: "Organization", description: "I represent an organization." },
            ].map((option) => <button key={option.value} type="button" role="radio" aria-checked={values.accountType === option.value} onClick={() => selectAccount(option.value as (typeof ACCOUNT_TYPES)[number])} className={`min-h-36 rounded-2xl border p-5 text-left transition-colors ${values.accountType === option.value ? "border-[#008f4c] bg-[#eaf8ef] ring-2 ring-[#008f4c]/15" : "border-black/10 bg-white hover:border-[#008f4c]/50"}`}>
              <span className="block text-xl font-bold text-[#092a23]">{option.title}</span><span className="mt-2 block text-sm leading-6 text-muted">{option.description}</span>
            </button>)}
          </div>
          <FieldError id="accountType" message={errors.accountType} />
        </section>}

        {step === 1 && <section aria-labelledby="onboarding-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008f4c]">{accountLabel} workspace</p>
          <h2 id="onboarding-step-title" className="mt-3 text-3xl font-semibold text-[#071f1b]">{isIndividual ? "What best describes your work?" : "What kind of organization is this?"}</h2>
          <p className="mt-3 leading-7 text-muted">{isIndividual ? "Choose the work you manage personally. This does not claim affiliation with an employer or institution." : "This helps us prepare the right operational tools without asking unnecessary questions."}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-describedby={isIndividual ? "professionalCategory-error" : "organizationType-error"}>
            {(isIndividual ? PROFESSIONS : ORGANIZATION_TYPES).map((option) => {
              const unavailable = "available" in option && !option.available;
              const selected = isIndividual ? values.professionalCategory === option.value : values.organizationType === option.value;
              return <button key={option.value} type="button" role="radio" aria-checked={selected} disabled={unavailable} onClick={() => isIndividual ? selectProfession(option.value) : update("organizationType", option.value)} className={`flex min-h-16 items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left ${selected ? "border-[#008f4c] bg-[#eaf8ef] ring-2 ring-[#008f4c]/15" : "border-black/10 bg-white"} disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/40`}>
                <span className="font-semibold">{option.label}</span>{unavailable && <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">Coming later</span>}
              </button>;
            })}
          </div>
          <FieldError id={isIndividual ? "professionalCategory" : "organizationType"} message={isIndividual ? errors.professionalCategory : errors.organizationType} />
        </section>}

        {step === 2 && <section aria-labelledby="onboarding-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008f4c]">Workspace details</p>
          <h2 id="onboarding-step-title" className="mt-3 text-3xl font-semibold text-[#071f1b]">{isIndividual ? "Tell us about your work" : "Tell us about your organization"}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-muted">{isIndividual ? "Use a workspace name your students or customers will recognize. It does not claim official affiliation with another organization." : "We only need the public name used by your team and visitors."}</p>
          <div className="mt-8 grid max-w-2xl gap-5">
            <label htmlFor="workspaceName" className="text-sm font-bold">{isIndividual ? "Workspace name" : "Organization name"}</label>
            <input id="workspaceName" value={values.workspaceName} onChange={(event) => update("workspaceName", event.target.value)} className={controlClass} maxLength={160} autoComplete="organization" placeholder={isIndividual ? "e.g. My Physics Classes" : "e.g. Greenfield Clinic"} aria-invalid={errors.workspaceName ? true : undefined} aria-describedby={errors.workspaceName ? "workspaceName-error" : undefined} />
            <FieldError id="workspaceName" message={errors.workspaceName} />
            {isLecturer && <><div><label htmlFor="teachingLevel" className="text-sm font-bold">Teaching level</label><input id="teachingLevel" value={values.teachingLevel} onChange={(event) => update("teachingLevel", event.target.value)} className={controlClass} maxLength={100} placeholder="e.g. University undergraduate" aria-invalid={errors.teachingLevel ? true : undefined} aria-describedby={errors.teachingLevel ? "teachingLevel-error" : undefined}/><FieldError id="teachingLevel" message={errors.teachingLevel}/></div><div><label htmlFor="institutionName" className="text-sm font-bold">Institution name <span className="font-normal text-muted">(optional)</span></label><input id="institutionName" value={values.institutionName} onChange={(event) => update("institutionName", event.target.value)} className={controlClass} maxLength={160} placeholder="For context only — no affiliation claim" aria-invalid={errors.institutionName ? true : undefined} aria-describedby={errors.institutionName ? "institutionName-error" : undefined}/><FieldError id="institutionName" message={errors.institutionName}/></div></>}
            {isProfessionalService && <div><label htmlFor="serviceName" className="text-sm font-bold">Service name</label><input id="serviceName" value={values.serviceName} onChange={(event) => update("serviceName", event.target.value)} className={controlClass} maxLength={160} placeholder="e.g. Consultations" aria-invalid={errors.serviceName ? true : undefined} aria-describedby={errors.serviceName ? "serviceName-error" : undefined}/><FieldError id="serviceName" message={errors.serviceName}/></div>}
          </div>
        </section>}

        {step === 3 && <section aria-labelledby="onboarding-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008f4c]">Workspace configuration</p>
          <h2 id="onboarding-step-title" className="mt-3 text-3xl font-semibold text-[#071f1b]">Set your local details</h2>
          <p className="mt-3 max-w-2xl leading-7 text-muted">Times and records use these settings. {isLecturer ? "No institution address is required." : "Your first service location can be changed later."}</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="country" className="text-sm font-bold">Country</label><select id="country" value={values.country} onChange={(event) => update("country", event.target.value)} className={controlClass} autoComplete="country" aria-invalid={errors.country ? true : undefined} aria-describedby={errors.country ? "country-error" : undefined}><option value="" disabled>Choose a country</option>{countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select><FieldError id="country" message={errors.country} /></div>
            <div><label htmlFor="timezone" className="text-sm font-bold">Timezone</label><select id="timezone" value={values.timezone} onChange={(event) => update("timezone", event.target.value)} className={controlClass} aria-invalid={errors.timezone ? true : undefined} aria-describedby={errors.timezone ? "timezone-error" : undefined}>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>)}</select><FieldError id="timezone" message={errors.timezone} /></div>
            {needsLocation && <><div><label htmlFor="locationName" className="text-sm font-bold">{isIndividual ? "Authorized practice or service location" : "First location name"}</label><input id="locationName" value={values.locationName} onChange={(event) => update("locationName", event.target.value)} className={controlClass} maxLength={160} placeholder="e.g. Main office" aria-invalid={errors.locationName ? true : undefined} aria-describedby={errors.locationName ? "locationName-error" : undefined} /><FieldError id="locationName" message={errors.locationName} /></div><div><label htmlFor="locationAddress" className="text-sm font-bold">Location address</label><textarea id="locationAddress" value={values.locationAddress} onChange={(event) => update("locationAddress", event.target.value)} className={controlClass} rows={3} maxLength={500} autoComplete="street-address" placeholder="Street address, city or town" aria-invalid={errors.locationAddress ? true : undefined} aria-describedby={errors.locationAddress ? "locationAddress-error" : undefined} /><FieldError id="locationAddress" message={errors.locationAddress} /></div></>}
          </div>
        </section>}

        {step === 4 && <section aria-labelledby="onboarding-step-title">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008f4c]">Review</p>
          <h2 id="onboarding-step-title" className="mt-3 text-3xl font-semibold text-[#071f1b]">Ready to create your workspace?</h2>
          <p className="mt-3 leading-7 text-muted">Review the details below. TuRnMaRk creates the workspace only after you confirm.</p>
          <dl className="mt-8 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white px-5 sm:px-7">
            {[
              ["Account type", accountLabel],
              [isIndividual ? "Profession" : "Organization type", isIndividual ? profession?.label : organization?.label],
              ["Workspace", values.workspaceName],
              ...(isLecturer ? [["Teaching level", values.teachingLevel], ...(values.institutionName ? [["Institution (context only)", values.institutionName]] : [])] : []),
              ...(isProfessionalService ? [["Service", values.serviceName]] : []),
              ["Country", countries.find(({ code }) => code === values.country)?.name],
              ["Timezone", values.timezone.replaceAll("_", " ")],
              ...(needsLocation ? [["First location", values.locationName], ["Address", values.locationAddress]] : []),
            ].map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-5"><dt className="text-sm text-muted">{label}</dt><dd className="min-w-0 [overflow-wrap:anywhere] font-semibold text-[#092a23]">{value}</dd></div>)}
          </dl>
          <p className="mt-5 rounded-xl bg-[#edf8e4] p-4 text-sm leading-6 text-[#24472f]">{isIndividual ? "This is your personal professional workspace. It does not represent your employer, institution, bank or professional regulator." : "You will be the owner of this organization workspace and can invite team members later."}</p>
        </section>}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-black/10 bg-[#f6f6ef] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || pending} className="min-h-12 rounded-xl border border-black/15 bg-white px-6 font-bold text-[#173e31] disabled:invisible">Back</button>
        {step < 4 ? <button type="button" onClick={continueToNextStep} className="min-h-12 rounded-xl bg-[#008f4c] px-7 font-bold text-white hover:bg-[#007b42]">Continue</button> : <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-[#b9ee57] px-7 font-bold text-[#08271f] hover:bg-[#a9dd4d] disabled:cursor-wait disabled:opacity-60">{pending ? "Creating your workspace…" : "Create workspace"}</button>}
      </div>
      <p role="status" className="sr-only">{pending ? "Saving your workspace. Please wait." : ""}</p>
    </form>
  );
}
