import { z } from "zod";

export const callNextInputSchema = z.object({ queueId: z.uuid(), requestId: z.uuid() }).strict();
export type CallNextInput = z.infer<typeof callNextInputSchema>;
export const callNextResponseSchema = z.object({
  outcome: z.enum(["called", "already_serving", "empty"]),
  replayed: z.boolean(),
  ticket_id: z.uuid().nullable(),
  display_number: z.string().regex(/^[A-Z]+[0-9]{3,}$/).max(20).nullable(),
  customer_name: z.string().min(1).max(80).nullable(),
  called_at: z.iso.datetime({ offset: true }).nullable(),
  ticket_status: z.enum(["waiting", "serving", "completed", "no_show", "cancelled"]).nullable(),
}).strict().superRefine((result, context) => {
  const fields = [result.ticket_id, result.display_number, result.customer_name, result.called_at, result.ticket_status];
  if (result.outcome === "empty" ? fields.some((field) => field !== null) : fields.some((field) => field === null)) {
    context.addIssue({ code: "custom", message: "Inconsistent Call Next result." });
  }
  if (result.outcome !== "empty" && (!result.replayed && result.ticket_status !== "serving"
    || result.ticket_status === "waiting" || result.ticket_status === "cancelled")) {
    context.addIssue({ code: "custom", message: "Invalid called ticket state." });
  }
});
export type CallNextResponse = z.output<typeof callNextResponseSchema>;
export type CallNextResult = { ok: true; result: CallNextResponse } | {
  ok: false;
  code: "invalid_input" | "forbidden" | "queue_unavailable" | "retry";
  message: string;
};
