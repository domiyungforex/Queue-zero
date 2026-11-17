import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  bookingSettingsSchema,
  bookTimeInputSchema,
  bookingAvailabilitySlotSchema,
} from "@/lib/booking/types";
import { getSelectableDates } from "@/lib/booking/availability";

describe("Booking Types & Schemas", () => {
  it("validates valid booking settings with defaults", () => {
    const raw = {
      organization_id: "a0000000-0000-4000-8000-000000000001",
    };
    const parsed = bookingSettingsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.enabled).toBe(true);
      expect(parsed.data.booking_type).toBe("SCHEDULED_ARRIVAL");
      expect(parsed.data.slot_interval_minutes).toBe(30);
      expect(parsed.data.max_capacity_per_slot).toBe(8);
      expect(parsed.data.arrival_grace_minutes).toBe(15);
      expect(parsed.data.operating_days).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("validates customer booking input", () => {
    const validInput = {
      slug: "general-consultation",
      date: "2026-12-01",
      startTime: "09:00:00",
      customerName: "Ada Lovelace",
      phone: "+2348012345678",
      email: "ada@example.com",
    };
    const parsed = bookTimeInputSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);

    // Empty email is tolerated
    const withoutEmail = { ...validInput, email: "" };
    expect(bookTimeInputSchema.safeParse(withoutEmail).success).toBe(true);

    // Invalid phone fails
    const badPhone = { ...validInput, phone: "12" };
    expect(bookTimeInputSchema.safeParse(badPhone).success).toBe(false);

    // Invalid date fails
    const badDate = { ...validInput, date: "not-a-date" };
    expect(bookTimeInputSchema.safeParse(badDate).success).toBe(false);
  });

  it("validates availability slot schema", () => {
    const slot = {
      start_time: "10:00",
      end_time: "10:30",
      total_capacity: 10,
      booked_count: 3,
      available_capacity: 7,
      is_available: true,
    };
    const parsed = bookingAvailabilitySlotSchema.safeParse(slot);
    expect(parsed.success).toBe(true);
  });

  it("calculates selectable dates within timezone and operating days", () => {
    const mockInfo = {
      queue_id: "00000000-0000-0000-0000-000000000001",
      queue_name: "Test Queue",
      service_name: "Test Service",
      queue_slug: "test-queue",
      organization_id: "00000000-0000-0000-0000-000000000002",
      business_name: "TuRnMaRk Labs",
      location_id: "00000000-0000-0000-0000-000000000003",
      location_name: "Main Branch",
      location_address: "123 Innovation Way",
      timezone: "Africa/Lagos",
      booking_enabled: true,
      booking_type: "SCHEDULED_ARRIVAL",
      operating_days: [1, 2, 3, 4, 5], // Mon-Fri
      opening_time: "08:00:00",
      closing_time: "17:00:00",
      slot_interval_minutes: 30,
      max_capacity_per_slot: 8,
      min_advance_minutes: 30,
      max_advance_days: 7,
      arrival_grace_minutes: 15,
      allocation_mode: "BOOKING_AND_WALK_IN",
      cancellation_allowed: true,
      rescheduling_allowed: true,
    };

    const dates = getSelectableDates(mockInfo);
    expect(dates.length).toBe(8); // today (day 0) through day 7
    expect(dates[0]).toHaveProperty("date");
    expect(dates[0]).toHaveProperty("label");
    expect(dates[0]).toHaveProperty("dayName");
    expect(dates[0]).toHaveProperty("available");

    // All elements should have ISO date format
    dates.forEach((d) => {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
