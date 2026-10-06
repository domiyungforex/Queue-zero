import { z } from "zod";

export const publicQueueSlugSchema = z.string().min(3).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

function safeLogoUrl(value: string | null): string | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
}

// This is the complete public contract. Schema drift must not serialize private fields.
export const publicQueueSchema = z.object({
  slug: publicQueueSlugSchema,
  business_name: z.string().min(1).max(160),
  business_logo_url: z.string().max(2048).nullable().transform(safeLogoUrl),
  queue_name: z.string().min(1).max(160),
  service_name: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  location_name: z.string().min(1).max(160),
  status: z.enum(["open", "paused", "closed"]),
  is_full: z.boolean(),
  waiting_count: z.number().int().nonnegative(),
  estimated_wait_seconds: z.number().int().nonnegative().nullable(),
  has_serving_customer: z.boolean(),
}).strict().refine((queue) => queue.status === "open" ? queue.estimated_wait_seconds !== null : queue.estimated_wait_seconds === null);

export type PublicQueue = z.output<typeof publicQueueSchema>;
