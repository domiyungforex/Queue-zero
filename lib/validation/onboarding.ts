import { z } from "zod";

export const INDUSTRIES = [
  { value: "healthcare", label: "Healthcare" },
  { value: "beauty_wellness", label: "Beauty and wellness" },
  { value: "retail", label: "Retail and customer service" },
  { value: "public_services", label: "Government and public services" },
  { value: "financial_services", label: "Financial services" },
  { value: "hospitality", label: "Hospitality" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const;

// ISO 3166-1 alpha-2 codes; display names are produced on the server.
export const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const countryCodes = new Set(COUNTRY_CODES);

export const ACCOUNT_TYPES = ["INDIVIDUAL", "ORGANIZATION"] as const;
export const PROFESSIONS = [
  { value: "LECTURER_TEACHER", label: "Lecturer / Teacher", available: true },
  { value: "DOCTOR", label: "Doctor", available: true },
  { value: "NURSE", label: "Nurse", available: true },
  { value: "BANKER", label: "Banker", available: true },
  { value: "BARBER_STYLIST", label: "Barber / Stylist", available: true },
  { value: "CONSULTANT", label: "Consultant", available: true },
  { value: "OTHER_PROFESSIONAL", label: "Other professional", available: true },
] as const;
export const SERVICE_PROFESSIONS = ["DOCTOR", "NURSE", "BANKER", "BARBER_STYLIST", "CONSULTANT", "OTHER_PROFESSIONAL"] as const;
export const ORGANIZATION_TYPE_VALUES = ["UNIVERSITY_SCHOOL", "HOSPITAL_CLINIC", "BANK_FINANCIAL", "SALON_BARBERSHOP", "GOVERNMENT_OFFICE", "COMPANY_OTHER"] as const;
export const ORGANIZATION_TYPES = [
  { value: "UNIVERSITY_SCHOOL", label: "University / School", industry: "education", mode: "SCHOOL" },
  { value: "HOSPITAL_CLINIC", label: "Hospital / Clinic", industry: "healthcare", mode: "BUSINESS" },
  { value: "BANK_FINANCIAL", label: "Bank / Financial institution", industry: "financial_services", mode: "BUSINESS" },
  { value: "SALON_BARBERSHOP", label: "Salon / Barbershop", industry: "beauty_wellness", mode: "BUSINESS" },
  { value: "GOVERNMENT_OFFICE", label: "Government office", industry: "public_services", mode: "BUSINESS" },
  { value: "COMPANY_OTHER", label: "Company / Other", industry: "other", mode: "BUSINESS" },
] as const;
export const ONBOARDING_FIELDS = ["onboardingRequestId", "accountType", "professionalCategory", "organizationType", "workspaceName", "teachingLevel", "institutionName", "serviceName", "country", "timezone", "locationName", "locationAddress"] as const;
export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];
export type OnboardingValues = Record<OnboardingField, string>;

const requiredText = (label: string, max: number) => z.string().trim()
  .min(1, `${label} is required.`).max(max, `Use ${max} characters or fewer.`);

const workspaceDetails = {
  onboardingRequestId: z.uuid("Start setup again and retry."),
  workspaceName: requiredText("Workspace name", 160),
  country: z.string().trim().toUpperCase().refine((value) => countryCodes.has(value), "Choose a country."),
  timezone: requiredText("Timezone", 100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; }
  }, "Choose a valid timezone."),
};

export const onboardingSchema = z.union([
  z.object({
    ...workspaceDetails,
    accountType: z.literal("INDIVIDUAL"),
    professionalCategory: z.literal("LECTURER_TEACHER", { error: "Choose an available profession." }),
    organizationType: z.literal(""),
    teachingLevel: requiredText("Teaching level", 100),
    institutionName: z.string().trim().max(160, "Use 160 characters or fewer."),
    serviceName: z.literal(""),
    locationName: z.literal(""),
    locationAddress: z.literal(""),
  }).strict(),
  z.object({
    ...workspaceDetails,
    accountType: z.literal("INDIVIDUAL"),
    professionalCategory: z.enum(SERVICE_PROFESSIONS, { error: "Choose a profession." }),
    organizationType: z.literal(""),
    teachingLevel: z.literal(""),
    institutionName: z.literal(""),
    serviceName: requiredText("Service name", 160),
    locationName: requiredText("Practice location", 160),
    locationAddress: requiredText("Location address", 500),
  }).strict(),
  z.object({
    ...workspaceDetails,
    accountType: z.literal("ORGANIZATION"),
    professionalCategory: z.literal(""),
    organizationType: z.enum(ORGANIZATION_TYPE_VALUES, { error: "Choose an organization type." }),
    teachingLevel: z.literal(""),
    institutionName: z.literal(""),
    serviceName: z.literal(""),
    locationName: requiredText("Location name", 160),
    locationAddress: requiredText("Location address", 500),
  }).strict(),
]);

export type OnboardingState = {
  status: "idle" | "error";
  message?: string;
  values?: OnboardingValues;
  fieldErrors?: Partial<Record<OnboardingField, string[] | undefined>>;
};
export type OnboardingAction = (previous: OnboardingState, formData: FormData) => Promise<OnboardingState>;
