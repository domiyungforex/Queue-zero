import "server-only";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/db/public";
import { publicTicketSchema, publicTicketTokenSchema } from "@/lib/validation/ticket";

export async function getPublicTicket(token: string) {
  if (!publicTicketTokenSchema.safeParse(token).success) return null;
  const { data, error } = await createPublicSupabaseClient().rpc("get_public_ticket", { p_token: token });
  if (error) throw new Error("We couldn’t load your ticket. Please try again.");
  const parsed = z.array(publicTicketSchema).max(1).safeParse(data);
  if (!parsed.success) throw new Error("Ticket details are temporarily unavailable.");
  return parsed.data[0] ?? null;
}
