import "server-only";
import { cache } from "react";
import { requireBusinessMembership, requireBusinessManager, requireBusinessOwner } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getDashboardQueues = cache(async () => {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();
  // RLS additionally limits staff to assigned queues.
  const { data, error } = await db.from("queues")
    .select("id,name,description,status,average_service_seconds,locations!queues_location_id_business_id_fkey(name)")
    .eq("business_id", membership.businessId).order("created_at", { ascending: true });
  if (error) throw new Error("We couldn’t load your queues. Please try again.");
  return data ?? [];
});

export const getDashboardLocations = cache(async () => {
  const current = await requireBusinessMembership();
  const membership = current.institutionType ? current : await requireBusinessManager();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("locations").select("id,name,address,timezone,is_active")
    .eq("business_id", membership.businessId).order("created_at", { ascending: true });
  if (error) throw new Error("We couldn’t load your locations. Please try again.");
  return data ?? [];
});

export const getBusinessDetails = cache(async () => {
  const membership = await requireBusinessOwner();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("businesses").select("name,industry,country_code,timezone,subscription_tier")
    .eq("id", membership.businessId).single();
  if (error || !data) throw new Error("We couldn’t load business details. Please try again.");
  return data;
});
