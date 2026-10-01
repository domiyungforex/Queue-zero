import type { PublicQueue } from "@/lib/validation/public-queue";

export const publicQueueFixture: PublicQueue = {
  slug: "doctor-consultation-public-slug",
  business_name: "Main Street Clinic",
  business_logo_url: null,
  queue_name: "Doctor Consultation",
  description: "General consultations and follow-up visits.",
  location_name: "Main Branch",
  status: "open",
  waiting_count: 8,
  estimated_wait_seconds: 1440,
  has_serving_customer: true,
};
