import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/db/public";
import { publicQueueSchema, publicQueueSlugSchema } from "@/lib/validation/public-queue";

export const getPublicQueue = cache(async (slug: string) => {
  if (!publicQueueSlugSchema.safeParse(slug).success) return null;
  const db = createPublicSupabaseClient();
  const { data, error } = await db.rpc("get_public_queue", { p_slug: slug });
  if (error) throw new Error("We couldn’t load this queue. Please try again.");
  const parsed = z.array(publicQueueSchema).max(1).safeParse(data);
  if (!parsed.success) throw new Error("Queue details are temporarily unavailable.");
  const queue = parsed.data[0] ?? null;
  if (queue && queue.slug !== slug) throw new Error("Queue details are temporarily unavailable.");
  return queue;
});
