import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/server";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getMemberships = cache(async () => {
  const userId = await requireUserId();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("business_members")
    .select("business_id,role,businesses!business_members_business_id_fkey(name,organization_mode)")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error("We couldn’t load your business. Please try again.");
  return (data ?? []).map((membership) => {
    if (!membership.businesses) throw new Error("Your business is temporarily unavailable.");
    return { businessId: membership.business_id, role: membership.role, businessName: membership.businesses.name, ...(membership.businesses.organization_mode ? { organizationMode: membership.businesses.organization_mode } : {}) };
  });
});

export const getCurrentMembership = cache(async () => {
  const memberships = await getMemberships();
  const selected = (await cookies()).get("queuezero-business")?.value;
  // A cookie is a preference, never authorization. Revoked/stale selections fall back safely.
  return memberships.find((membership) => membership.businessId === selected) ?? memberships[0] ?? null;
});

export const requireBusinessMembership = cache(async () => {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  return membership;
});

export const requireBusinessManager = cache(async () => {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/dashboard");
  return membership;
});

export const requireBusinessOwner = cache(async () => {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner") redirect("/dashboard");
  return membership;
});
