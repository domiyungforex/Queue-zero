"use server";

import { z } from "zod";
import { scheduleNotifications } from "@/lib/notifications/schedule";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { publicTicketTokenSchema, type CancelTicketState } from "@/lib/validation/ticket";

export async function cancelTicket(token: string, _previous: CancelTicketState, form: FormData): Promise<CancelTicketState> {
  const parsed = publicTicketTokenSchema.safeParse(token);
  if (!parsed.success) return { status: "error", message: "This ticket link is unavailable. Please ask staff for help." };
  if (!z.literal("yes").safeParse(form.get("confirm")).success) return { status: "error", message: "Confirm that you want to leave the queue." };
  try {
    const { data, error } = await createJoinSupabaseClient().rpc("cancel_public_ticket", { p_token: parsed.data });
    if (error?.code === "QZ007") return { status: "error", message: "Your ticket is no longer waiting. Refresh your ticket and speak to staff if you need help." };
    if (error?.code === "QZ001") return { status: "error", message: "This ticket link is unavailable. Please ask staff for help." };
    if (error || data !== "cancelled") return { status: "error", message: "We couldn’t confirm the cancellation. Retry to safely check or finish leaving the queue." };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: "We couldn’t confirm the cancellation. Retry to safely check or finish leaving the queue." };
  }
  scheduleNotifications();
  revalidatePath(`/ticket/${parsed.data}`);
  redirect(`/ticket/${parsed.data}`);
}
