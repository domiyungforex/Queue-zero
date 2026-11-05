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

export function safeAnalyticsProperties(input?: AnalyticsProperties): AnalyticsProperties {
  if (!input) return {};
  const safe: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_PROPERTY_KEYS.has(key as keyof AnalyticsProperties) || typeof value !== "string") continue;
    if (value.length > 120 || !/^[A-Za-z0-9_./:-]+$/.test(value)) continue;
    (safe as Record<string, string>)[key] = value;
  }
  return safe;
}
