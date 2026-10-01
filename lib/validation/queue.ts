import { z } from "zod";

export const QUEUE_FIELDS = ["name", "description", "locationId", "serviceMinutes", "warningThreshold", "phoneMode"] as const;
export type QueueField = (typeof QUEUE_FIELDS)[number];
export type QueueValues = Record<QueueField, string>;

export const queueSchema = z.object({
  name: z.string().trim().min(1, "Enter a queue name.").max(160, "Use 160 characters or fewer."),
  description: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  locationId: z.uuid("Choose a location."),
  serviceMinutes: z.string().trim().min(1, "Enter the typical service time.")
    .pipe(z.coerce.number<string>().min(1 / 60, "Use at least one second (0.017 minutes).").max(1440, "Use 1,440 minutes or fewer."))
    .transform((minutes) => Math.round(minutes * 60)),
  warningThreshold: z.string().trim().min(1, "Enter a notification threshold.")
    .pipe(z.coerce.number<string>().int("Use a whole number.").min(0, "Use zero or more.").max(100, "Use 100 or fewer.")),
  phoneMode: z.enum(["none", "optional", "required"], { error: "Choose a phone number option." }),
}).strict();

export const queueContextSchema = z.object({ businessId: z.uuid(), queueId: z.uuid() }).strict();
export const queueEditContextSchema = queueContextSchema.extend({ revision: z.number().int().positive() });
export const queueStatusSchema = z.enum(["open", "paused", "closed"]);
export type QueueContext = z.infer<typeof queueContextSchema>;
export type QueueEditContext = z.infer<typeof queueEditContextSchema>;
export type QueueState = {
  status: "idle" | "error";
  message?: string;
  values?: QueueValues;
  fieldErrors?: Partial<Record<QueueField, string[]>>;
  conflict?: boolean;
};
export type QueueAction = (previous: QueueState, formData: FormData) => Promise<QueueState>;
