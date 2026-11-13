import "server-only";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/db/public";
import {
  bookingAvailabilitySlotSchema,
  publicBookingInfoSchema,
  type BookingAvailabilitySlot,
  type PublicBookingInfo,
} from "./types";

/**
 * Loads public booking configuration and details for a queue by slug.
 */
export async function getPublicBookingInfo(slug: string): Promise<PublicBookingInfo | null> {
  const db = createPublicSupabaseClient();
  const { data, error } = await db.rpc("get_public_booking_info", { p_slug: slug });
  if (error || !data) return null;

  const parsed = publicBookingInfoSchema.safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Invalid public booking info response", parsed.error);
    }
    return null;
  }
  return parsed.data;
}

/**
 * Returns available booking slots for a queue slug on a specific date.
 */
export async function getBookingAvailability(
  slug: string,
  dateStr: string
): Promise<BookingAvailabilitySlot[]> {
  const db = createPublicSupabaseClient();
  const { data, error } = await db.rpc("get_booking_availability", {
    p_slug: slug,
    p_date: dateStr,
  });

  if (error || !data) return [];

  const parsed = z.array(bookingAvailabilitySlotSchema).safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Invalid availability slots response", parsed.error);
    }
    return [];
  }
  return parsed.data;
}

/**
 * Calculates selectable dates within the organization's horizon and operating days.
 */
export function getSelectableDates(
  info: PublicBookingInfo
): Array<{ date: string; label: string; dayName: string; available: boolean }> {
  const dates: Array<{ date: string; label: string; dayName: string; available: boolean }> = [];
  const maxDays = info.max_advance_days || 14;
  const operatingDays = new Set(info.operating_days || [1, 2, 3, 4, 5]);

  // Use timezone from info
  const now = new Date();
  
  for (let i = 0; i <= maxDays; i++) {
    const target = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    // Format YYYY-MM-DD in target timezone
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: info.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatter.format(target);

    // Compute ISO day of week (1=Mon, 7=Sun)
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: info.timezone,
      weekday: "short",
    });
    const dayName = dayFormatter.format(target);

    const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: info.timezone,
      month: "short",
      day: "numeric",
    });
    const label = monthDayFormatter.format(target);

    // Get day index
    const weekdayIdx = target.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isoDow = weekdayIdx === 0 ? 7 : weekdayIdx;

    const available = operatingDays.has(isoDow);

    dates.push({
      date: dateStr,
      label,
      dayName,
      available,
    });
  }

  return dates;
}
