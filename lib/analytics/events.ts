export const ANALYTICS_EVENTS = {
  marketingPageViewed: "marketing_page_viewed",
  pricingViewed: "pricing_viewed",
  demoRequested: "demo_requested",
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  onboardingStarted: "onboarding_started",
  accountTypeSelected: "account_type_selected",
  professionSelected: "profession_selected",
  organizationTypeSelected: "organization_type_selected",
  workspaceCreated: "workspace_created",
  onboardingCompleted: "onboarding_completed",
  workspaceOpened: "workspace_opened",
  workspaceSwitched: "workspace_switched",
  teamMemberInvited: "team_member_invited",
  queueCreated: "queue_created",
  queueQrViewed: "queue_qr_viewed",
  customerQueueJoined: "customer_queue_joined",
  customerTicketViewed: "customer_ticket_viewed",
  queueCallNext: "queue_call_next",
  customerTurnNotified: "customer_turn_notified",
  queueServiceCompleted: "queue_service_completed",
  queueCustomerCancelled: "queue_customer_cancelled",
  queueCustomerNoShow: "queue_customer_no_show",
  courseCreated: "course_created",
  classSessionStarted: "class_session_started",
  attendanceQrDisplayed: "attendance_qr_displayed",
  attendanceQrCheckinSucceeded: "attendance_qr_checkin_succeeded",
  attendanceQrCheckinFailed: "attendance_qr_checkin_failed",
  attendanceAssistedRecorded: "attendance_assisted_recorded",
  attendanceSessionClosed: "attendance_session_closed",
  attendanceReportExported: "attendance_report_exported",
  billingPageViewed: "billing_page_viewed",
  checkoutStarted: "checkout_started",
  subscriptionActivated: "subscription_activated",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsProperties = {
  account_type?: "INDIVIDUAL" | "ORGANIZATION";
  workspace_type?: "INDIVIDUAL" | "ORGANIZATION" | "BUSINESS" | "SCHOOL" | "HYBRID";
  profession_category?: string;
  organization_category?: string;
  user_role?: string;
  plan_tier?: string;
  queue_type?: string;
  service_category?: string;
  capture_method?: "qr" | "assisted";
  device_category?: "mobile" | "tablet" | "desktop";
  feature_name?: string;
  page_path?: string;
  page_category?: "marketing" | "application";
};

const SAFE_PROPERTY_KEYS = new Set<keyof AnalyticsProperties>([
  "account_type", "workspace_type", "profession_category", "organization_category",
  "user_role", "plan_tier", "queue_type", "service_category", "capture_method",
  "device_category", "feature_name", "page_path", "page_category",
]);

const SAFE_ENUM_VALUES: Partial<Record<keyof AnalyticsProperties, ReadonlySet<string>>> = {
  account_type: new Set(["INDIVIDUAL", "ORGANIZATION"]),
  workspace_type: new Set(["INDIVIDUAL", "ORGANIZATION", "BUSINESS", "SCHOOL", "HYBRID"]),
  profession_category: new Set(["LECTURER_TEACHER", "DOCTOR", "NURSE", "BANKER", "BARBER_STYLIST", "CONSULTANT", "OTHER_PROFESSIONAL"]),
  organization_category: new Set(["UNIVERSITY_SCHOOL", "HOSPITAL_CLINIC", "BANK_FINANCIAL", "SALON_BARBERSHOP", "GOVERNMENT_OFFICE", "COMPANY_OTHER"]),
  user_role: new Set(["owner", "admin", "manager", "staff", "viewer", "lecturer", "student"]),
  plan_tier: new Set(["FREE", "STARTER", "BUSINESS"]),
  capture_method: new Set(["qr", "assisted"]),
  device_category: new Set(["mobile", "tablet", "desktop"]),
  page_category: new Set(["marketing", "application"]),
  feature_name: new Set(["queue_management", "school_attendance", "billing", "workspace"]),
};

export function safeAnalyticsProperties(input?: AnalyticsProperties): AnalyticsProperties {
  if (!input) return {};
  const safe: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(input)) {
    const typedKey = key as keyof AnalyticsProperties;
    if (!SAFE_PROPERTY_KEYS.has(typedKey) || typeof value !== "string" || value.length > 200) continue;
    if (typedKey === "page_path") {
      if (!value.startsWith("/") || value.includes("?") || value.includes("#") || !/^[A-Za-z0-9_./:-]+$/.test(value)) continue;
    } else {
      const allowed = SAFE_ENUM_VALUES[typedKey];
      if (!allowed?.has(value)) continue;
    }
    (safe as Record<string, string>)[key] = value;
  }
  return safe;
}
