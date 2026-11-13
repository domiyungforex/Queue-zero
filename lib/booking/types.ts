import { z } from "zod";

export const bookingTypeSchema = z.enum([
  "SCHEDULED_ARRIVAL",
  "SERVICE_APPOINTMENT",
  "FUTURE_QUEUE_RESERVATION",
]);
export type BookingType = z.infer<typeof bookingTypeSchema>;

export const bookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "WAITING",
  "CALLED",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "EXPIRED",
  "NO_SHOW",
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const allocationModeSchema = z.enum([
  "BOOKING_AND_WALK_IN",
  "BOOKING_ONLY",
  "WALK_IN_ONLY",
]);
export type AllocationMode = z.infer<typeof allocationModeSchema>;

export const bookingPriorityPolicySchema = z.enum([
  "ARRIVAL_ORDER",
  "SCHEDULED_WINDOW_PRIORITY",
  "RESERVED_CAPACITY",
]);
export type BookingPriorityPolicy = z.infer<typeof bookingPriorityPolicySchema>;

export const bookingSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  queue_id: z.string().uuid().nullable().optional(),
  enabled: z.boolean().default(true),
  booking_type: bookingTypeSchema.default("SCHEDULED_ARRIVAL"),
  operating_days: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
  opening_time: z.string().default("08:00:00"),
  closing_time: z.string().default("17:00:00"),
  slot_interval_minutes: z.number().int().default(30),
  max_capacity_per_slot: z.number().int().positive().default(8),
  min_advance_minutes: z.number().int().nonnegative().default(30),
  max_advance_days: z.number().int().positive().default(14),
  arrival_grace_minutes: z.number().int().nonnegative().default(15),
  allocation_mode: allocationModeSchema.default("BOOKING_AND_WALK_IN"),
  walkin_reserved_capacity: z.number().int().nonnegative().default(4),
  booking_priority_policy: bookingPriorityPolicySchema.default("ARRIVAL_ORDER"),
  cancellation_allowed: z.boolean().default(true),
  rescheduling_allowed: z.boolean().default(true),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const bookingAvailabilitySlotSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  total_capacity: z.number().int().nonnegative(),
  booked_count: z.number().int().nonnegative(),
  available_capacity: z.number().int().nonnegative(),
  is_available: z.boolean(),
});
export type BookingAvailabilitySlot = z.infer<typeof bookingAvailabilitySlotSchema>;

export const publicBookingInfoSchema = z.object({
  queue_id: z.string().uuid(),
  queue_name: z.string(),
  service_name: z.string(),
  queue_slug: z.string(),
  description: z.string().nullable().optional(),
  organization_id: z.string().uuid(),
  business_name: z.string(),
  business_logo_url: z.string().nullable().optional(),
  location_id: z.string().uuid(),
  location_name: z.string(),
  location_address: z.string(),
  timezone: z.string().default("Africa/Lagos"),
  booking_enabled: z.boolean().default(true),
  booking_type: z.string().default("SCHEDULED_ARRIVAL"),
  operating_days: z.array(z.number()).default([1, 2, 3, 4, 5]),
  opening_time: z.string().default("08:00:00"),
  closing_time: z.string().default("17:00:00"),
  slot_interval_minutes: z.number().default(30),
  max_capacity_per_slot: z.number().default(8),
  min_advance_minutes: z.number().default(30),
  max_advance_days: z.number().default(14),
  arrival_grace_minutes: z.number().default(15),
  allocation_mode: z.string().default("BOOKING_AND_WALK_IN"),
  cancellation_allowed: z.boolean().default(true),
  rescheduling_allowed: z.boolean().default(true),
});
export type PublicBookingInfo = z.infer<typeof publicBookingInfoSchema>;

export const bookTimeInputSchema = z.object({
  slug: z.string().min(3).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(4).max(8),
  customerName: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(3).max(32),
  email: z.string().trim().email().optional().or(z.literal("")),
  requestId: z.string().uuid().optional(),
});
export type BookTimeInput = z.infer<typeof bookTimeInputSchema>;

export const publicBookingSchema = z.object({
  id: z.string().uuid(),
  booking_reference: z.string(),
  management_token: z.string().uuid(),
  customer_name: z.string(),
  customer_phone: z.string(),
  customer_email: z.string().nullable().optional(),
  booking_type: z.string(),
  booking_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string(),
  status: z.string(),
  checked_in_at: z.string().nullable().optional(),
  can_check_in: z.boolean().default(false),
  arrival_grace_minutes: z.number().default(15),
  queue_id: z.string().uuid(),
  queue_name: z.string(),
  service_name: z.string(),
  queue_slug: z.string(),
  business_name: z.string(),
  location_name: z.string(),
  location_address: z.string(),
  ticket: z
    .object({
      id: z.string().uuid(),
      display_number: z.string(),
      status: z.string(),
      public_token: z.string().uuid(),
      people_ahead: z.number().nullable().optional(),
      estimated_wait_seconds: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type PublicBooking = z.infer<typeof publicBookingSchema>;

export const staffBookingFilterSchema = z.object({
  date: z.string().optional(),
  queueId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type StaffBookingFilter = z.infer<typeof staffBookingFilterSchema>;
