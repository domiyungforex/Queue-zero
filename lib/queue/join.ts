import "server-only";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/db/public";
import { publicQueueSlugSchema } from "@/lib/validation/public-queue";
import { joinOptionsSchema, ticketReceiptSchema } from "@/lib/validation/join";

export async function getPublicJoinOptions(slug: string) {
  if (!publicQueueSlugSchema.safeParse(slug).success) return null;
  const { data, error } = await createPublicSupabaseClient().rpc("get_public_join_options_v2", { p_slug: slug });
  if (error) throw new Error("We couldn’t load the join form. Please try again.");
  const parsed = z.array(joinOptionsSchema).max(1).safeParse(data);
  if (!parsed.success || (parsed.data[0] && parsed.data[0].slug !== slug)) throw new Error("Join details are temporarily unavailable.");
  return parsed.data[0] ?? null;
}

export async function getTicketReceipt(token: string) {
  if (!z.uuid().safeParse(token).success) return null;
  const { data, error } = await createPublicSupabaseClient().rpc("get_public_ticket_receipt", { p_token: token });
  if (error) throw new Error("We couldn’t load your ticket. Please try again.");
  const parsed = z.array(ticketReceiptSchema).max(1).safeParse(data);
  if (!parsed.success) throw new Error("Ticket details are temporarily unavailable.");
  return parsed.data[0] ?? null;
}
