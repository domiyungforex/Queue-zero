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

export const ONBOARDING_FIELDS = ["businessName", "industry", "country", "timezone", "locationName", "locationAddress"] as const;
export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];
export type OnboardingValues = Record<OnboardingField, string> & { organizationMode?: string };

const requiredText = (label: string, max: number) => z.string().trim()
  .min(1, `${label} is required.`).max(max, `Use ${max} characters or fewer.`);

export const onboardingSchema = z.object({
  organizationMode: z.enum(["BUSINESS", "SCHOOL", "HYBRID"]).optional(),
  businessName: requiredText("Business name", 160),
  industry: z.string().refine((value) => INDUSTRIES.some((industry) => industry.value === value), "Choose an industry."),
  country: z.string().trim().toUpperCase().refine((value) => countryCodes.has(value), "Choose a country."),
  timezone: requiredText("Timezone", 100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; }
  }, "Choose a valid timezone."),
  locationName: requiredText("Location name", 160),
  locationAddress: requiredText("Location address", 500),
}).strict();

export type OnboardingState = {
  status: "idle" | "error";
  message?: string;
  values?: OnboardingValues;
  fieldErrors?: Partial<Record<OnboardingField, string[]>>;
};
export type OnboardingAction = (previous: OnboardingState, formData: FormData) => Promise<OnboardingState>;
