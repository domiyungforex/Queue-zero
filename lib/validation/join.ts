import { z } from "zod";
import { publicQueueSlugSchema } from "@/lib/validation/public-queue";

export const joinContextSchema = z.object({ slug: publicQueueSlugSchema, requestId: z.uuid() }).strict();
export type JoinContext = z.infer<typeof joinContextSchema>;
export const joinInputSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(80, "Use 80 characters or fewer.")
    .refine((value) => !Array.from(value).some((character) => { const code = character.codePointAt(0)!; return code < 32 || code === 127; }), "Use a name without control characters."),
  phone: z.string().max(32, "Use 32 characters or fewer."),
}).strict();
export const joinOptionsSchema = z.object({
  slug: publicQueueSlugSchema,
  business_name: z.string().min(1).max(160),
  queue_name: z.string().min(1).max(160),
  service_name: z.string().min(1).max(160),
  status: z.enum(["open", "paused", "closed"]),
  is_full: z.boolean(),
  allow_phone: z.boolean(),
  require_phone: z.boolean(),
}).strict().refine((value) => !value.require_phone || value.allow_phone);
export type JoinOptions = z.output<typeof joinOptionsSchema>;
export type JoinState = {
  status: "idle" | "error";
  message?: string;
  values?: { firstName: string; phone: string };
  fieldErrors?: { firstName?: string[]; phone?: string[] };
  refreshRequired?: boolean;
};
export type JoinAction = (previous: JoinState, form: FormData) => Promise<JoinState>;
export const ticketReceiptSchema = z.object({
  display_number: z.string().regex(/^[A-Z]+[0-9]{3,}$/).max(20),
  business_name: z.string().min(1).max(160), queue_name: z.string().min(1).max(160),
  status: z.enum(["waiting", "serving", "completed", "no_show", "cancelled"]),
}).strict();
