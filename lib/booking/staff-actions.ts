"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createUserSupabaseClient } from "@/lib/db/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import {
  bookingSettingsSchema,
  staffBookingFilterSchema,
  type BookingSettings,
  type StaffBookingFilter,
} from "./types";
import { scheduleNotifications } from "@/lib/notifications/schedule";

export type StaffBookingItem = {
  id: string;
  booking_reference: string;
  management_token: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  status: string;
  checked_in_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  queue_id: string;
  queue_name: string;
  service_name: string;
  location_name: string;
  ticket_number: string | null;
  ticket_status: string | null;
  ticket_public_token: string | null;
};

export type StaffBookingMetrics = {
  date: string;
  total: number;
  confirmed: number;
  checked_in: number;
  cancelled: number;
  no_show: number;
  completed: number;
};

export async function fetchStaffBookings(
  filter: StaffBookingFilter
): Promise<{ total: number; bookings: StaffBookingItem[] }> {
  const membership = await requireBusinessMembership();
  const parsed = staffBookingFilterSchema.safeParse(filter);
  const data = parsed.success ? parsed.data : { limit: 50, offset: 0 };

  const db = await createUserSupabaseClient();
  const { data: res, error } = await db.rpc("get_staff_bookings", {
    p_business_id: membership.businessId,
    p_date: data.date || null,
    p_queue_id: data.queueId || null,
    p_status: data.status || null,
    p_search: data.search || null,
    p_limit: data.limit,
    p_offset: data.offset,
  });

  if (error || !res) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("fetchStaffBookings error:", error);
    }
    return { total: 0, bookings: [] };
  }

  const typedRes = res as { total: number; bookings: StaffBookingItem[] };
  return {
    total: typedRes.total ?? 0,
    bookings: typedRes.bookings ?? [],
  };
}

export async function fetchStaffBookingMetrics(date?: string): Promise<StaffBookingMetrics> {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.rpc("get_booking_metrics", {
    p_business_id: membership.businessId,
    p_date: date || null,
  });

  if (error || !data) {
    return {
      date: date || new Date().toISOString().split("T")[0],
      total: 0,
      confirmed: 0,
      checked_in: 0,
      cancelled: 0,
      no_show: 0,
      completed: 0,
    };
  }

  return data as StaffBookingMetrics;
}

export async function staffCheckInBooking(
  bookingId: string
): Promise<{ ok: boolean; message: string; ticketToken?: string }> {
  const [, userId] = await Promise.all([
    requireBusinessMembership(),
    requireUserId(),
  ]);
  if (!z.string().uuid().safeParse(bookingId).success) {
    return { ok: false, message: "Invalid booking ID." };
  }

  try {
    const db = await createUserSupabaseClient();
    const { data, error } = await db.rpc("check_in_booking_atomic", {
      p_token: bookingId,
      p_actor_type: "staff",
      p_actor_id: userId,
    });

    if (error) {
      return { ok: false, message: error.message || "Failed to check in customer." };
    }

    const res = data as {
      ok: boolean;
      display_number?: string;
      public_token?: string;
    };

    scheduleNotifications();
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard");

    return {
      ok: true,
      message: res.display_number ? `Checked in! Ticket #${res.display_number}` : "Checked in!",
      ticketToken: res.public_token,
    };
  } catch {
    return { ok: false, message: "Connection error during check-in." };
  }
}

export async function staffCancelBooking(
  bookingId: string,
  reason: string
): Promise<{ ok: boolean; message: string }> {
  const [, userId] = await Promise.all([
    requireBusinessMembership(),
    requireUserId(),
  ]);
  if (!z.string().uuid().safeParse(bookingId).success) {
    return { ok: false, message: "Invalid booking ID." };
  }

  try {
    const db = await createUserSupabaseClient();
    const { error } = await db.rpc("cancel_booking_atomic", {
      p_token: bookingId,
      p_reason: reason || "Cancelled by staff",
      p_actor_type: "staff",
      p_actor_id: userId,
    });

    if (error) {
      return { ok: false, message: error.message || "Could not cancel booking." };
    }

    scheduleNotifications();
    revalidatePath("/dashboard/bookings");
    return { ok: true, message: "Booking cancelled." };
  } catch {
    return { ok: false, message: "Connection error during cancellation." };
  }
}

export async function staffMarkNoShow(
  bookingId: string
): Promise<{ ok: boolean; message: string }> {
  const [membership, userId] = await Promise.all([
    requireBusinessMembership(),
    requireUserId(),
  ]);
  if (!z.string().uuid().safeParse(bookingId).success) {
    return { ok: false, message: "Invalid booking ID." };
  }

  try {
    const db = await createUserSupabaseClient();
    const { error } = await db
      .from("bookings")
      .update({
        status: "NO_SHOW",
        no_show_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("organization_id", membership.businessId)
      .eq("status", "CONFIRMED");

    if (error) {
      return { ok: false, message: error.message || "Could not update status." };
    }

    // Insert booking event
    await db.from("booking_events").insert({
      organization_id: membership.businessId,
      booking_id: bookingId,
      event_type: "no_show",
      actor_type: "staff",
      actor_id: userId,
    });

    revalidatePath("/dashboard/bookings");
    return { ok: true, message: "Marked as No-Show." };
  } catch {
    return { ok: false, message: "Connection error." };
  }
}

export async function staffRescheduleBooking(
  bookingId: string,
  newDate: string,
  newStartTime: string
): Promise<{ ok: boolean; message: string }> {
  const [, userId] = await Promise.all([
    requireBusinessMembership(),
    requireUserId(),
  ]);
  if (!z.string().uuid().safeParse(bookingId).success) {
    return { ok: false, message: "Invalid booking ID." };
  }

  try {
    const db = await createUserSupabaseClient();
    const { error } = await db.rpc("reschedule_booking_atomic", {
      p_token: bookingId,
      p_new_date: newDate,
      p_new_start_time: newStartTime,
      p_actor_type: "staff",
      p_actor_id: userId,
    });

    if (error) {
      return { ok: false, message: error.message || "Could not reschedule booking." };
    }

    scheduleNotifications();
    revalidatePath("/dashboard/bookings");
    return { ok: true, message: "Booking rescheduled successfully." };
  } catch {
    return { ok: false, message: "Connection error." };
  }
}

export async function fetchBookingSettings(queueId?: string): Promise<BookingSettings> {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();

  // Try queue-specific if queueId given
  if (queueId) {
    const { data } = await db
      .from("booking_settings")
      .select("*")
      .eq("organization_id", membership.businessId)
      .eq("queue_id", queueId)
      .maybeSingle();

    if (data) {
      return data as BookingSettings;
    }
  }

  // Try org-level default
  const { data } = await db
    .from("booking_settings")
    .select("*")
    .eq("organization_id", membership.businessId)
    .is("queue_id", null)
    .maybeSingle();

  if (data) {
    return data as BookingSettings;
  }

  // Fallback defaults
  return {
    organization_id: membership.businessId,
    queue_id: queueId || null,
    enabled: true,
    booking_type: "SCHEDULED_ARRIVAL",
    operating_days: [1, 2, 3, 4, 5],
    opening_time: "08:00:00",
    closing_time: "17:00:00",
    slot_interval_minutes: 30,
    max_capacity_per_slot: 8,
    min_advance_minutes: 30,
    max_advance_days: 14,
    arrival_grace_minutes: 15,
    allocation_mode: "BOOKING_AND_WALK_IN",
    walkin_reserved_capacity: 4,
    booking_priority_policy: "ARRIVAL_ORDER",
    cancellation_allowed: true,
    rescheduling_allowed: true,
  };
}

export async function saveBookingSettings(
  settings: BookingSettings
): Promise<{ ok: boolean; message: string }> {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, message: "Only owners and admins can configure booking settings." };
  }

  const parsed = bookingSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    return { ok: false, message: "Invalid settings format." };
  }

  try {
    const db = await createUserSupabaseClient();
    const payload = {
      organization_id: membership.businessId,
      queue_id: parsed.data.queue_id || null,
      enabled: parsed.data.enabled,
      booking_type: parsed.data.booking_type,
      operating_days: parsed.data.operating_days,
      opening_time: parsed.data.opening_time,
      closing_time: parsed.data.closing_time,
      slot_interval_minutes: parsed.data.slot_interval_minutes,
      max_capacity_per_slot: parsed.data.max_capacity_per_slot,
      min_advance_minutes: parsed.data.min_advance_minutes,
      max_advance_days: parsed.data.max_advance_days,
      arrival_grace_minutes: parsed.data.arrival_grace_minutes,
      allocation_mode: parsed.data.allocation_mode,
      walkin_reserved_capacity: parsed.data.walkin_reserved_capacity,
      booking_priority_policy: parsed.data.booking_priority_policy,
      cancellation_allowed: parsed.data.cancellation_allowed,
      rescheduling_allowed: parsed.data.rescheduling_allowed,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from("booking_settings")
      .upsert(payload, {
        onConflict: "organization_id,coalesce(queue_id, '00000000-0000-0000-0000-000000000000'::uuid)",
      });

    if (error) {
      // Fallback simple insert/update
      const existing = await db
        .from("booking_settings")
        .select("id")
        .eq("organization_id", membership.businessId)
        .match(payload.queue_id ? { queue_id: payload.queue_id } : {})
        .maybeSingle();

      if (existing.data?.id) {
        await db.from("booking_settings").update(payload).eq("id", existing.data.id);
      } else {
        await db.from("booking_settings").insert(payload);
      }
    }

    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/bookings/settings");
    return { ok: true, message: "Booking settings updated." };
  } catch {
    return { ok: false, message: "Failed to update settings. Please retry." };
  }
}
