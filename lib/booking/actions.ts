"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createPublicSupabaseClient } from "@/lib/db/public";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import {
  bookTimeInputSchema,
  publicBookingSchema,
  type PublicBooking,
} from "./types";
import { scheduleNotifications } from "@/lib/notifications/schedule";

export type BookingResult =
  | {
      ok: true;
      managementToken: string;
      bookingReference: string;
      booking: Record<string, unknown>;
    }
  | {
      ok: false;
      message: string;
      code?: string;
    };

export async function createBooking(input: unknown): Promise<BookingResult> {
  const parsed = bookTimeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check your details and select a valid time window.",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = createJoinSupabaseClient();
    const { data, error } = await db.rpc("book_time_atomic", {
      p_slug: parsed.data.slug,
      p_date: parsed.data.date,
      p_start_time: parsed.data.startTime,
      p_customer_name: parsed.data.customerName,
      p_phone: parsed.data.phone,
      p_email: parsed.data.email || null,
      p_request_id: parsed.data.requestId ?? crypto.randomUUID(),
    });

    if (error) {
      if (error.code === "QZ010") {
        return {
          ok: false,
          message: "This time window just filled up. Please pick another available time.",
          code: "SLOT_FULL",
        };
      }
      if (error.code === "QZ008") {
        return {
          ok: false,
          message: "This time window is no longer available. Please choose a later time.",
          code: "TOO_SOON",
        };
      }
      return {
        ok: false,
        message: error.message || "We couldn't confirm this booking. Please try again.",
        code: error.code,
      };
    }

    const res = data as {
      ok?: boolean;
      management_token?: string;
      booking_reference?: string;
    };

    if (!res || !res.management_token) {
      return {
        ok: false,
        message: "Booking confirmation was not received. Please try again.",
        code: "INVALID_RESPONSE",
      };
    }

    scheduleNotifications();
    revalidatePath(`/book/${parsed.data.slug}`);

    return {
      ok: true,
      managementToken: res.management_token,
      bookingReference: res.booking_reference ?? "",
      booking: res as Record<string, unknown>,
    };
  } catch {
    return {
      ok: false,
      message: "Connection interrupted. Please try again safely.",
      code: "NETWORK_ERROR",
    };
  }
}

export async function getBookingByToken(token: string): Promise<PublicBooking | null> {
  if (!z.string().uuid().safeParse(token).success) return null;

  const db = createPublicSupabaseClient();
  const { data, error } = await db.rpc("get_public_booking", { p_token: token });
  if (error || !data) return null;

  const parsed = publicBookingSchema.safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Invalid public booking schema parse:", parsed.error);
    }
    return null;
  }
  return parsed.data;
}

export async function checkInCustomerBooking(token: string): Promise<{
  ok: boolean;
  message?: string;
  ticket?: {
    public_token: string;
    display_number: string;
    status: string;
    people_ahead: number | null;
  };
}> {
  if (!z.string().uuid().safeParse(token).success) {
    return { ok: false, message: "Invalid booking token." };
  }

  try {
    const db = createJoinSupabaseClient();
    const { data, error } = await db.rpc("check_in_booking_atomic", {
      p_token: token,
      p_actor_type: "customer",
    });

    if (error) {
      if (error.code === "QZ011") {
        return {
          ok: false,
          message: "Too early to check in. Check-in opens 20 minutes before your arrival window.",
        };
      }
      if (error.code === "QZ012") {
        return {
          ok: false,
          message: "Your arrival grace period has passed. Please speak with staff at the desk.",
        };
      }
      return { ok: false, message: error.message || "Could not complete check-in." };
    }

    const res = data as {
      ok: boolean;
      public_token?: string;
      display_number?: string;
      status?: string;
      people_ahead?: number;
    };

    if (res && res.public_token && res.display_number) {
      scheduleNotifications();
      revalidatePath(`/booking/${token}`);
      return {
        ok: true,
        ticket: {
          public_token: res.public_token,
          display_number: res.display_number,
          status: res.status || "waiting",
          people_ahead: res.people_ahead ?? 0,
        },
      };
    }

    return { ok: false, message: "Could not generate queue ticket. Please contact staff." };
  } catch {
    return { ok: false, message: "Connection interrupted. Please try again." };
  }
}

export async function cancelCustomerBooking(
  token: string,
  reason?: string
): Promise<{ ok: boolean; message?: string }> {
  if (!z.string().uuid().safeParse(token).success) {
    return { ok: false, message: "Invalid booking token." };
  }

  try {
    const db = createJoinSupabaseClient();
    const { error } = await db.rpc("cancel_booking_atomic", {
      p_token: token,
      p_reason: reason || "Cancelled by customer",
      p_actor_type: "customer",
    });

    if (error) {
      return { ok: false, message: error.message || "Could not cancel booking." };
    }

    scheduleNotifications();
    revalidatePath(`/booking/${token}`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Connection interrupted. Please try again." };
  }
}

export async function rescheduleCustomerBooking(
  token: string,
  newDate: string,
  newStartTime: string
): Promise<{ ok: boolean; message?: string }> {
  if (!z.string().uuid().safeParse(token).success) {
    return { ok: false, message: "Invalid booking token." };
  }

  try {
    const db = createJoinSupabaseClient();
    const { error } = await db.rpc("reschedule_booking_atomic", {
      p_token: token,
      p_new_date: newDate,
      p_new_start_time: newStartTime,
      p_actor_type: "customer",
    });

    if (error) {
      if (error.code === "QZ010") {
        return { ok: false, message: "The selected time window is full. Please choose another." };
      }
      return { ok: false, message: error.message || "Could not reschedule booking." };
    }

    scheduleNotifications();
    revalidatePath(`/booking/${token}`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Connection interrupted. Please try again." };
  }
}
