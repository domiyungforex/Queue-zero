import { z } from "zod";
import { publicQueueSlugSchema } from "@/lib/validation/public-queue";

export const publicTicketTokenSchema = z.uuid();
export const publicTicketSchema = z.object({
  display_number: z.string().regex(/^[A-Z]+[0-9]{3,}$/).max(20),
  status: z.enum(["waiting", "serving", "completed", "no_show", "cancelled"]),
  joined_at: z.iso.datetime({ offset: true }),
  business_name: z.string().min(1).max(160),
  queue_name: z.string().min(1).max(160),
  queue_slug: publicQueueSlugSchema,
  location_name: z.string().min(1).max(160),
  location_timezone: z.string().refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }),
  queue_status: z.enum(["open", "paused", "closed"]),
  location_active: z.boolean(),
  people_ahead: z.number().int().nonnegative().safe().nullable(),
  estimated_wait_seconds: z.number().int().nonnegative().safe().nullable(),
  has_serving_customer: z.boolean(),
  warning_threshold: z.number().int().min(0).max(100).optional(),
}).strict().superRefine((ticket, context) => {
  if ((ticket.status === "waiting") !== (ticket.people_ahead !== null)) {
    context.addIssue({ code: "custom", message: "Invalid ticket position." });
  }
  const hasEstimate = ticket.status === "waiting" && ticket.queue_status === "open" && ticket.location_active;
  if (hasEstimate !== (ticket.estimated_wait_seconds !== null)) {
    context.addIssue({ code: "custom", message: "Invalid ticket estimate." });
  }
});
export type PublicTicket = z.output<typeof publicTicketSchema>;
export type CancelTicketState = { status: "idle" | "error"; message?: string };
export type CancelTicketAction = (previous: CancelTicketState, form: FormData) => Promise<CancelTicketState>;
