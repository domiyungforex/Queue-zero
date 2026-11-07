"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Banknote, BriefcaseBusiness, Building2, Check, CircleDollarSign, ClipboardCheck,
  CreditCard, GraduationCap, HeartPulse, Landmark, MapPin, MessageCircleQuestion,
  Scissors, ShieldCheck, Sparkles, Stethoscope, University, UserRound, UsersRound,
} from "lucide-react";
import {
  ACCOUNT_TYPES, ONBOARDING_FIELDS, ORGANIZATION_SERVICE_TEMPLATES, ORGANIZATION_SUBTYPES,
  ORGANIZATION_TYPES, PROFESSIONS, type OnboardingAction, type OnboardingField,
  type OnboardingState, type OnboardingValues,
} from "@/lib/validation/onboarding";
import { TURNMARK_ASSETS, type TurnmarkAsset } from "@/lib/brand/assets";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  ActionFooter, ChoiceCard, ErrorBanner, Field, OnboardingFrame, ReviewRow, ScreenHeader,
  onboardingStyles as styles,
} from "./onboarding-ui";

const initialState: OnboardingState = { status: "idle" };
const initialValues: OnboardingValues = {
  onboardingRequestId: "", accountType: "", professionalCategory: "", organizationType: "",
  organizationSubtype: "", workspaceName: "", legalName: "", representativeName: "",
  serviceTemplates: "", teachingLevel: "", institutionName: "", serviceName: "",
  country: "", timezone: "UTC", locationName: "", locationAddress: "", authorizationDeclaration: "",
};

type StepKey = "account" | "profession" | "organization" | "details" | "location" | "services" | "workspace" | "review";
const individualSteps = ["Account", "Profession", "Details", "Workspace", "Review"] as const;
const individualKeys: readonly StepKey[] = ["account", "profession", "details", "workspace", "review"];
const organizationSteps = ["Account", "Type", "Details", "Location", "Services", "Workspace", "Review"] as const;
const organizationKeys: readonly StepKey[] = ["account", "organization", "details", "location", "services", "workspace", "review"];

const professionIcons = {
  LECTURER_TEACHER: GraduationCap, DOCTOR: Stethoscope, NURSE: HeartPulse, BANKER: Landmark,
  BARBER_STYLIST: Scissors, CONSULTANT: BriefcaseBusiness, OTHER_PROFESSIONAL: Sparkles,
} as const;
const organizationIcons = {
  UNIVERSITY_SCHOOL: University, HOSPITAL_CLINIC: HeartPulse, BANK_FINANCIAL: Landmark,
  SALON_BARBERSHOP: Scissors, GOVERNMENT_OFFICE: Building2, COMPANY_OTHER: BriefcaseBusiness,
} as const;
const professionVisuals: Partial<Record<string, TurnmarkAsset>> = {
  LECTURER_TEACHER: TURNMARK_ASSETS.characters.student,
  DOCTOR: TURNMARK_ASSETS.characters.healthcareProfessional,
  NURSE: TURNMARK_ASSETS.characters.healthcareProfessional,
  BANKER: TURNMARK_ASSETS.characters.businessProfessional,
  CONSULTANT: TURNMARK_ASSETS.characters.businessProfessional,
};
const organizationVisuals: Partial<Record<string, TurnmarkAsset>> = {
  UNIVERSITY_SCHOOL: TURNMARK_ASSETS.industries.education,
  HOSPITAL_CLINIC: TURNMARK_ASSETS.industries.healthcare,
  GOVERNMENT_OFFICE: TURNMARK_ASSETS.industries.government,
};
const serviceIcons: Record<string, typeof Sparkles> = {
  STUDENT_SERVICES: GraduationCap, ADMISSIONS: ClipboardCheck, BURSARY: CircleDollarSign,
  LIBRARY: University, MEDICAL_CENTRE: HeartPulse, DEPARTMENT_OFFICE: Building2,
  RECEPTION: UsersRound, CONSULTATION: Stethoscope, LABORATORY: HeartPulse, PHARMACY_PICKUP: ClipboardCheck,
  CUSTOMER_SERVICE: UsersRound, ACCOUNT_OPENING: ClipboardCheck, DEPOSITS: Banknote,
  WITHDRAWALS: Banknote, CARD_SERVICES: CreditCard, LOAN_ENQUIRIES: CircleDollarSign,
  COMPLAINTS: MessageCircleQuestion, DOCUMENT_VERIFICATION: ShieldCheck, WALK_IN_SERVICE: Scissors,
  GENERAL_ENQUIRIES: MessageCircleQuestion, DOCUMENT_SERVICES: ClipboardCheck, PAYMENTS: CircleDollarSign,
  CUSTOM_SERVICE: Sparkles,
};
const descriptions: Record<string,string> = {
  LECTURER_TEACHER: "Courses, class sessions and QR attendance.", DOCTOR: "Consultation queues without medical records.",
  NURSE: "Manage an independent service workflow.", BANKER: "A personal service workspace without bank affiliation.",
  BARBER_STYLIST: "Services, customer queues and supported appointments.", CONSULTANT: "A flexible client service workspace.",
  OTHER_PROFESSIONAL: "Configure a service around how you work.", UNIVERSITY_SCHOOL: "Courses, attendance and campus service queues.",
  HOSPITAL_CLINIC: "Reception and consultation service flow.", BANK_FINANCIAL: "Branch services with verification before activation.",
  SALON_BARBERSHOP: "Walk-ins, services and supported appointments.", GOVERNMENT_OFFICE: "Public service counters and queues.",
  COMPANY_OTHER: "Locations, custom services and team operations.",
};

function stepForField(field: OnboardingField, individual: boolean): StepKey {
  if (field === "accountType") return "account";
  if (field === "professionalCategory") return "profession";
  if (field === "organizationType") return "organization";
  if (field === "locationName" || field === "locationAddress") return individual ? "details" : "location";
  if (field === "serviceTemplates") return "services";
  if (field === "workspaceName") return "workspace";
  if (field === "authorizationDeclaration") return "review";
  return "details";
}

export function OnboardingForm({ action, countries, timezones, requestId }: {
  action: OnboardingAction; countries: { code: string; name: string }[]; timezones: string[]; requestId: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<OnboardingValues>({ ...initialValues, onboardingRequestId: requestId });
  const [clientErrors, setClientErrors] = useState<Partial<Record<OnboardingField,string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);
  const onboardingStarted = useRef(false);
  const isIndividual = values.accountType !== "ORGANIZATION";
  const isLecturer = isIndividual && values.professionalCategory === "LECTURER_TEACHER";
  const isProfessionalService = isIndividual && Boolean(values.professionalCategory) && !isLecturer;
  const keys = isIndividual ? individualKeys : organizationKeys;
  const labels = isIndividual ? individualSteps : organizationSteps;
  const currentKey = keys[Math.min(step, keys.length - 1)];

  async function submitAction(previous: OnboardingState, formData: FormData) {
    const result = await action(previous, formData);
    const submittedIndividual = (result.values?.accountType ?? values.accountType) !== "ORGANIZATION";
    const firstField = ONBOARDING_FIELDS.find((field) => result.fieldErrors?.[field]?.length);
    if (firstField) {
      const targetKeys = submittedIndividual ? individualKeys : organizationKeys;
      setStep(Math.max(0, targetKeys.indexOf(stepForField(firstField, submittedIndividual))));
    }
    return result;
  }
  const [state, formAction, pending] = useActionState(submitAction, initialState);
  const serverErrors = Object.fromEntries(Object.entries(state.fieldErrors ?? {}).map(([field,messages])=>[field,messages?.[0]]));
  const errors = { ...serverErrors, ...clientErrors } as Partial<Record<OnboardingField,string>>;

  useEffect(() => {
    if (!onboardingStarted.current) { onboardingStarted.current = true; captureAnalytics(ANALYTICS_EVENTS.onboardingStarted); }
    if (firstRender.current) { firstRender.current = false; return; }
    document.getElementById("onboarding-step-title")?.focus();
  }, [step]);
  useEffect(() => {
    if (state.status !== "error") return;
    requestAnimationFrame(()=>{
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? formRef.current?.querySelector<HTMLElement>('[role="alert"]');
      target?.focus();
    });
  }, [state]);

  function update(field: OnboardingField, value: string) {
    setValues((current)=>({ ...current, [field]: value }));
    setClientErrors((current)=>{ const next={...current}; delete next[field]; return next; });
  }
  function selectAccount(accountType: (typeof ACCOUNT_TYPES)[number]) {
    captureAnalytics(ANALYTICS_EVENTS.accountTypeSelected, { account_type: accountType });
    setValues((current)=>({
      ...current, accountType,
      professionalCategory: accountType === "INDIVIDUAL" ? current.professionalCategory : "",
      organizationType: accountType === "ORGANIZATION" ? current.organizationType : "",
      organizationSubtype: accountType === "ORGANIZATION" ? current.organizationSubtype : "",
      legalName: accountType === "ORGANIZATION" ? current.legalName : "",
      representativeName: accountType === "ORGANIZATION" ? current.representativeName : "",
      serviceTemplates: accountType === "ORGANIZATION" ? current.serviceTemplates : "",
      authorizationDeclaration: accountType === "ORGANIZATION" ? current.authorizationDeclaration : "",
      teachingLevel: accountType === "INDIVIDUAL" ? current.teachingLevel : "",
      institutionName: accountType === "INDIVIDUAL" ? current.institutionName : "",
      serviceName: accountType === "INDIVIDUAL" ? current.serviceName : "",
    }));
    setClientErrors({});
  }
  function selectProfession(category: string) {
    captureAnalytics(ANALYTICS_EVENTS.professionSelected, { profession_category: category });
    const lecturer = category === "LECTURER_TEACHER";
    setValues((current)=>({ ...current, professionalCategory: category,
      teachingLevel: lecturer ? current.teachingLevel : "", institutionName: lecturer ? current.institutionName : "",
      serviceName: lecturer ? "" : current.serviceName, locationName: lecturer ? "" : current.locationName,
      locationAddress: lecturer ? "" : current.locationAddress,
    }));
    setClientErrors({});
  }
  function selectOrganization(type: string) {
    captureAnalytics(ANALYTICS_EVENTS.organizationTypeSelected, { organization_category: type });
    setValues((current)=>({ ...current, organizationType:type, organizationSubtype:"", representativeName:"", serviceTemplates:"", authorizationDeclaration:"" }));
    setClientErrors({});
  }
  function toggleTemplate(template: string) {
    const selected = new Set(values.serviceTemplates.split(",").filter(Boolean));
    if (selected.has(template)) selected.delete(template); else selected.add(template);
    update("serviceTemplates", [...selected].join(","));
  }

  const organizationType = values.organizationType as keyof typeof ORGANIZATION_SUBTYPES;
  const organizationSubtypes = values.organizationType ? ORGANIZATION_SUBTYPES[organizationType] : [];
  const organizationTemplates = values.organizationType ? ORGANIZATION_SERVICE_TEMPLATES[organizationType] : [];
  const selectedTemplates = useMemo(()=>new Set(values.serviceTemplates.split(",").filter(Boolean)),[values.serviceTemplates]);
  const profession = PROFESSIONS.find((item)=>item.value===values.professionalCategory);
  const organization = ORGANIZATION_TYPES.find((item)=>item.value===values.organizationType);

  function validateCurrentStep() {
    const next: Partial<Record<OnboardingField,string>> = {};
    if (currentKey === "account" && !values.accountType) next.accountType = "Choose individual or organization.";
    if (currentKey === "profession" && !values.professionalCategory) next.professionalCategory = "Choose a profession.";
    if (currentKey === "organization" && !values.organizationType) next.organizationType = "Choose an organization type.";
    if (currentKey === "details") {
      if (!values.workspaceName.trim()) next.workspaceName = isIndividual ? "Display name is required." : "Organization name is required.";
      if (!values.country) next.country = "Choose a country.";
      if (!values.timezone) next.timezone = "Choose a timezone.";
      if (isLecturer && !values.teachingLevel.trim()) next.teachingLevel = "Teaching level is required.";
      if (isProfessionalService && !values.serviceName.trim()) next.serviceName = "Service name is required.";
      if (isProfessionalService && !values.locationName.trim()) next.locationName = "Service location is required.";
      if (isProfessionalService && !values.locationAddress.trim()) next.locationAddress = "Location address is required.";
      if (!isIndividual) {
        if (!values.organizationSubtype) next.organizationSubtype = "Choose an organization category.";
        if (!values.legalName.trim()) next.legalName = "Legal organization name is required.";
        if (values.organizationType === "BANK_FINANCIAL" && !values.representativeName.trim()) next.representativeName = "Authorized representative is required.";
      }
    }
    if (currentKey === "location") {
      if (!values.locationName.trim()) next.locationName = "Location name is required.";
      if (!values.locationAddress.trim()) next.locationAddress = "Location address is required.";
    }
    if (currentKey === "services" && !values.serviceTemplates) next.serviceTemplates = "Choose at least one service.";
    if (currentKey === "workspace" && !values.workspaceName.trim()) next.workspaceName = "Workspace display name is required.";
    if (currentKey === "review" && !isIndividual && values.authorizationDeclaration !== "true") next.authorizationDeclaration = "Confirm that you are authorized to register this organization.";
    setClientErrors(next);
    const first = ONBOARDING_FIELDS.find((field)=>next[field]);
    if (first) requestAnimationFrame(()=>document.getElementById(first)?.focus());
    return !first;
  }
  function nextStep() { if (validateCurrentStep()) setStep((current)=>Math.min(current+1,keys.length-1)); }
  function goTo(key: StepKey) { const index=keys.indexOf(key); if (index>=0) setStep(index); }
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (currentKey !== "review") {
      event.preventDefault();
      nextStep();
      return;
    }
    if (!validateCurrentStep()) event.preventDefault();
  }
  const input = (field: OnboardingField) => ({ id:field, className:styles.control, value:values[field], onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(field,event.target.value), "aria-invalid":errors[field]?true:undefined, "aria-describedby":errors[field]?`${field}-error`:undefined });
  const countryName = countries.find((item)=>item.code===values.country)?.name;

  return <form ref={formRef} action={formAction} onSubmit={onSubmit} onReset={(event)=>event.preventDefault()} aria-busy={pending} className="min-w-0">
    {ONBOARDING_FIELDS.map((field)=><input key={field} type="hidden" name={field} value={values[field]}/>) }
    <OnboardingFrame steps={labels} step={step}>
      <fieldset disabled={pending} className={styles.content}><legend className="sr-only">TuRnMaRk workspace onboarding</legend><div className={styles.contentInner}>
        {state.status==="error"?<ErrorBanner message={state.message??"We couldn’t complete setup. Try again."}/>:null}

        {currentKey==="account"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="Welcome" title="Welcome to" description="Let’s set up your workspace. Choose how you’ll use TuRnMaRk." brand/><div className={styles.choiceGrid} role="radiogroup" aria-describedby={errors.accountType?"accountType-error":undefined}><ChoiceCard title="Individual" description="I want to manage my own work and services." selected={values.accountType==="INDIVIDUAL"} icon={<UserRound/>} onSelect={()=>selectAccount("INDIVIDUAL")}/><ChoiceCard title="Organization" description="I represent a school, hospital, bank, business or other organization." selected={values.accountType==="ORGANIZATION"} icon={<Building2/>} onSelect={()=>selectAccount("ORGANIZATION")}/></div>{errors.accountType?<p id="accountType-error" className={styles.fieldError}>{errors.accountType}</p>:null}<p className={styles.signIn}>Already have a workspace? <Link href="/sign-in">Sign in</Link></p></section>:null}

        {currentKey==="profession"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="Individual workspace" title="What’s your profession?" description="Choose the option that best describes the work you manage. You can change supporting details later."/><div className={`${styles.choiceGrid} ${styles.choiceGridCompact}`} role="radiogroup" aria-describedby={errors.professionalCategory?"professionalCategory-error":undefined}>{PROFESSIONS.map((option)=>{const Icon=professionIcons[option.value];return <ChoiceCard key={option.value} title={option.label} description={descriptions[option.value]} selected={values.professionalCategory===option.value} icon={<Icon/>} visual={professionVisuals[option.value]} onSelect={()=>selectProfession(option.value)}/>})}</div>{errors.professionalCategory?<p id="professionalCategory-error" className={styles.fieldError}>{errors.professionalCategory}</p>:null}</section>:null}

        {currentKey==="organization"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="Organization workspace" title="What type of organization are you registering?" description="Choose the closest match. Entering a name does not verify an institutional affiliation."/><div className={`${styles.choiceGrid} ${styles.choiceGridCompact}`} role="radiogroup" aria-describedby={errors.organizationType?"organizationType-error":undefined}>{ORGANIZATION_TYPES.map((option)=>{const Icon=organizationIcons[option.value];return <ChoiceCard key={option.value} title={option.label} description={descriptions[option.value]} selected={values.organizationType===option.value} icon={<Icon/>} visual={organizationVisuals[option.value]} onSelect={()=>selectOrganization(option.value)}/>})}</div>{errors.organizationType?<p id="organizationType-error" className={styles.fieldError}>{errors.organizationType}</p>:null}</section>:null}

        {currentKey==="details"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow={isIndividual?"Your details":"Organization details"} title={isIndividual?"Tell us about yourself":"Organization information"} description={isIndividual?"These details shape your personal professional workspace.":"Add the public and operational details needed to create the organization workspace."}/><div className={styles.formGrid}>
          <Field id="workspaceName" label={isIndividual?"Display name":"Organization name"} error={errors.workspaceName} className={styles.full}><input {...input("workspaceName")} maxLength={160} autoComplete={isIndividual?"name":"organization"} placeholder={isIndividual?"e.g. Ada’s teaching workspace":"e.g. Olabisi Onabanjo University"}/></Field>
          {isIndividual?<Field id="profession" label="Profession"><output id="profession" className={styles.readOnly}><BriefcaseBusiness size={17}/>{profession?.label}</output></Field>:<Field id="organizationSubtype" label="Organization category" error={errors.organizationSubtype}><select {...input("organizationSubtype")}><option value="" disabled>Choose a category</option>{organizationSubtypes.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>}
          {!isIndividual?<Field id="legalName" label="Legal organization name" error={errors.legalName}><input {...input("legalName")} maxLength={200} autoComplete="organization" placeholder="Registered or official name"/></Field>:null}
          {!isIndividual&&values.organizationType==="BANK_FINANCIAL"?<Field id="representativeName" label="Authorized representative" error={errors.representativeName} hint="This records the representative making the request; it does not verify the institution."><input {...input("representativeName")} maxLength={160} autoComplete="name" placeholder="Full name"/></Field>:null}
          {isLecturer?<><Field id="teachingLevel" label="Teaching level" error={errors.teachingLevel}><input {...input("teachingLevel")} maxLength={100} placeholder="e.g. University undergraduate"/></Field><Field id="institutionName" label="Workplace or institution description" optional error={errors.institutionName} hint="Context only. It does not claim official affiliation."><input {...input("institutionName")} maxLength={160} placeholder="e.g. Independent lecturer"/></Field></>:null}
          {isProfessionalService?<><Field id="serviceName" label="Service name" error={errors.serviceName}><input {...input("serviceName")} maxLength={160} placeholder="e.g. Consultations"/></Field><Field id="locationName" label="Authorized practice or service location" error={errors.locationName}><input {...input("locationName")} maxLength={160} placeholder="e.g. Main office"/></Field><Field id="locationAddress" label="Location address" error={errors.locationAddress} className={styles.full}><textarea {...input("locationAddress")} maxLength={500} rows={3} autoComplete="street-address" placeholder="Street address, city or town"/></Field></>:null}
          <Field id="country" label="Country" error={errors.country}><select {...input("country")} autoComplete="country"><option value="" disabled>Choose a country</option>{countries.map((country)=><option key={country.code} value={country.code}>{country.name}</option>)}</select></Field>
          <Field id="timezone" label="Timezone" error={errors.timezone}><select {...input("timezone")}>{timezones.map((timezone)=><option key={timezone} value={timezone}>{timezone.replaceAll("_"," ")}</option>)}</select></Field>
        </div></section>:null}

        {currentKey==="location"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="First location" title="Add your first location" description="Add the campus, branch, premises or service location where this workspace will operate."/><div className={styles.formGrid}><Field id="locationName" label="Location name" error={errors.locationName}><input {...input("locationName")} maxLength={160} placeholder="e.g. Main campus"/></Field><Field id="locationAddress" label="Address" error={errors.locationAddress} className={styles.full}><textarea {...input("locationAddress")} maxLength={500} rows={4} autoComplete="street-address" placeholder="Street address, city or town"/></Field><Field id="locationCountry" label="Country"><output id="locationCountry" className={styles.readOnly}><MapPin size={17}/>{countryName}</output></Field><Field id="locationTimezone" label="Timezone"><output id="locationTimezone" className={styles.readOnly}>{values.timezone.replaceAll("_"," ")}</output></Field></div></section>:null}

        {currentKey==="services"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="Services" title="What services will you offer?" description="Choose the templates relevant to your organization. These selections guide setup and never create active public queues."/><div id="serviceTemplates" tabIndex={-1} className={styles.serviceGrid} aria-invalid={errors.serviceTemplates?true:undefined} aria-describedby={errors.serviceTemplates?"serviceTemplates-error":undefined}>{organizationTemplates.map((option)=>{const Icon=serviceIcons[option.value]??Sparkles;return <label key={option.value} className={styles.service}><input type="checkbox" checked={selectedTemplates.has(option.value)} onChange={()=>toggleTemplate(option.value)}/><span className={styles.serviceMark}><Icon size={15}/></span><span>{option.label}</span><span className={styles.serviceBox}><Check size={13}/></span></label>})}</div>{errors.serviceTemplates?<p id="serviceTemplates-error" className={styles.fieldError}>{errors.serviceTemplates}</p>:null}</section>:null}

        {currentKey==="workspace"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="Workspace" title="Set up your workspace" description="Confirm the name people will recognize and how the first setup should begin."/><div className={styles.formGrid}><Field id="workspaceName" label="Workspace display name" error={errors.workspaceName} className={styles.full}><input {...input("workspaceName")} maxLength={160}/></Field><Field id="language" label="Preferred language"><output id="language" className={styles.readOnly}>English</output><p className={styles.fieldHint}>English is currently the supported workspace language.</p></Field></div><div className={styles.setupGrid}><div className={`${styles.setupCard} ${isIndividual?styles.setupCardSelected:styles.setupCardDisabled}`}><span className={styles.setupRadio}/><div><strong>Start with an empty workspace</strong><p>{isIndividual?"Create your first course, service or queue from the dashboard.":"Organization setup currently requires the service templates selected in the previous step."}</p></div></div><div className={`${styles.setupCard} ${!isIndividual?styles.setupCardSelected:styles.setupCardDisabled}`}><span className={styles.setupRadio}/><div><strong>Use recommended setup</strong><p>{!isIndividual?"Keep your selected services as setup guidance. No live queue is created.":"Recommended automation is not required for personal workspaces."}</p></div></div></div></section>:null}

        {currentKey==="review"?<section className={styles.screen} aria-labelledby="onboarding-step-title"><ScreenHeader eyebrow="Final check" title="Review your information" description="Confirm every detail before creating the workspace. You can return to any section without losing progress."/><dl className={styles.review}><ReviewRow label="Account type" value={isIndividual?"Individual":"Organization"} onEdit={()=>goTo("account")}/><ReviewRow label={isIndividual?"Profession":"Organization type"} value={isIndividual?profession?.label:organization?.label} onEdit={()=>goTo(isIndividual?"profession":"organization")}/><ReviewRow label={isIndividual?"Display name":"Organization name"} value={values.workspaceName} onEdit={()=>goTo("details")}/>{isLecturer?<ReviewRow label="Teaching level" value={values.teachingLevel} onEdit={()=>goTo("details")}/>:null}{isProfessionalService?<ReviewRow label="Service" value={values.serviceName} onEdit={()=>goTo("details")}/>:null}{!isIndividual?<><ReviewRow label="Category" value={organizationSubtypes.find((option)=>option.value===values.organizationSubtype)?.label} onEdit={()=>goTo("details")}/><ReviewRow label="Location" value={`${values.locationName}, ${values.locationAddress}`} onEdit={()=>goTo("location")}/><ReviewRow label="Services" value={organizationTemplates.filter((option)=>selectedTemplates.has(option.value)).map((option)=>option.label).join(", ")} onEdit={()=>goTo("services")}/></>:null}<ReviewRow label="Country" value={countryName} onEdit={()=>goTo("details")}/><ReviewRow label="Timezone" value={values.timezone.replaceAll("_"," ")} onEdit={()=>goTo("details")}/><ReviewRow label="Workspace" value={values.workspaceName} onEdit={()=>goTo("workspace")}/></dl>{!isIndividual?<><label className={styles.declaration}><input id="authorizationDeclaration" type="checkbox" checked={values.authorizationDeclaration==="true"} onChange={(event)=>update("authorizationDeclaration",event.target.checked?"true":"")} aria-invalid={errors.authorizationDeclaration?true:undefined} aria-describedby={errors.authorizationDeclaration?"authorizationDeclaration-error":undefined}/><span>I confirm that I am authorized to register this organization and agree to the Terms of Service and Privacy Policy.</span></label>{errors.authorizationDeclaration?<p id="authorizationDeclaration-error" className={styles.fieldError}>{errors.authorizationDeclaration}</p>:null}</>:<div className={styles.notice}><ShieldCheck size={17}/><span>This is a personal professional workspace. It does not represent or verify an employer, institution, bank or regulator.</span></div>}</section>:null}
      </div></fieldset>
      <ActionFooter first={step===0} final={currentKey==="review"} pending={pending} onBack={()=>setStep((current)=>Math.max(0,current-1))} onContinue={nextStep}/>
      <p role="status" className="sr-only">{pending?"Saving your workspace. Please wait.":""}</p>
    </OnboardingFrame>
  </form>;
}
