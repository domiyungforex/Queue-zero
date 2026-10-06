import { z } from "zod";

export const QUEUE_FIELDS = [
  "name",
  "serviceName",
  "description",
  "locationId",
  "serviceMinutes",
  "capacity",
  "opensAt",
  "closesAt",
  "status",
  "warningThreshold",
  "phoneMode",
] as const;
export type QueueField = (typeof QUEUE_FIELDS)[number];
export type QueueValues = Record<QueueField, string>;

const timeField = z.string().trim()
  .refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Use a valid time.");

export const queueSchema = z.object({
  name: z.string().trim().min(1, "Enter a queue name.").max(160, "Use 160 characters or fewer."),
  serviceName: z.string().trim().min(1, "Enter the service name.").max(160, "Use 160 characters or fewer."),
  description: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  locationId: z.uuid("Choose a location."),
  serviceMinutes: z.string().trim().min(1, "Enter the typical service time.")
    .pipe(z.coerce.number<string>().min(1 / 60, "Use at least one second (0.017 minutes).").max(1440, "Use 1,440 minutes or fewer."))
    .transform((minutes) => Math.round(minutes * 60)),
  capacity: z.string().trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Use a whole number.")
    .transform((value) => value === "" ? null : Number(value))
    .refine((value) => value === null || (value >= 1 && value <= 1000), "Use between 1 and 1,000 customers."),
  opensAt: timeField.transform((value) => value || null),
  closesAt: timeField.transform((value) => value || null),
  status: z.enum(["open", "paused", "closed"], { error: "Choose a queue status." }),
  warningThreshold: z.string().trim().min(1, "Enter a notification threshold.")
    .pipe(z.coerce.number<string>().int("Use a whole number.").min(0, "Use zero or more.").max(100, "Use 100 or fewer.")),
  phoneMode: z.enum(["none", "optional", "required"], { error: "Choose a phone number option." }),
}).strict().superRefine((value, ctx) => {
  if ((value.opensAt === null) !== (value.closesAt === null)) {
    ctx.addIssue({ code: "custom", path: ["opensAt"], message: "Set both opening and closing time, or leave both blank." });
    ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Set both opening and closing time, or leave both blank." });
  }
  if (value.opensAt !== null && value.opensAt === value.closesAt) {
    ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Closing time must differ from opening time." });
  }
});

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
