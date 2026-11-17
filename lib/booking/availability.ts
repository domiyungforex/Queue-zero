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
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("get_public_booking_info failed", error.message, error.code);
    }
    return null;
  }
  if (!data) return null;

  const parsed = publicBookingInfoSchema.safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Invalid public booking info response", parsed.error.flatten());
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

export { getSelectableDates } from "./dates";
