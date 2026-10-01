import type { PublicTicket } from "@/lib/validation/ticket";
export const publicTicketFixture: PublicTicket = {
  display_number: "A014", status: "waiting", joined_at: "2026-10-01T10:00:00+00:00",
  business_name: "Main Street Clinic", queue_name: "Doctor Consultation", queue_slug: "clinic-consultation",
  location_name: "Main Branch", location_timezone: "Africa/Accra", queue_status: "open", location_active: true,
  people_ahead: 4, estimated_wait_seconds: 1200, has_serving_customer: true,
};
