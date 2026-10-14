import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getManagedQueue = cache(async (queueId: string) => {
  const membership = await requireBusinessMembership();
  if (!z.uuid().safeParse(queueId).success) notFound();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("queues")
    .select("id,name,description,slug,status,unit_id,location_id,average_service_seconds,warning_threshold,allow_phone,require_phone,revision,locations!queues_location_id_business_id_fkey(name)")
    .eq("id", queueId).eq("business_id", membership.businessId).maybeSingle();
  if (error) throw new Error("We couldn’t load this queue. Please try again.");
  if (!data) notFound();
  return data;
});
