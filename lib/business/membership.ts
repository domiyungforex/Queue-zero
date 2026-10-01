import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/server";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getCurrentMembership = cache(async () => {
  const userId = await requireUserId();
  const db = await createUserSupabaseClient();
  // Managers can read other memberships under RLS, so explicitly select self.
  const { data, error } = await db.from("business_members")
    .select("business_id,role,businesses!business_members_business_id_fkey(name)")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: true }).order("id", { ascending: true })
    .limit(1).maybeSingle();
  if (error) throw new Error("We couldn’t load your business. Please try again.");
  if (!data) return null;
  if (!data.businesses) throw new Error("Your business is temporarily unavailable.");
  return { businessId: data.business_id, role: data.role, businessName: data.businesses.name };
});

export const requireBusinessMembership = cache(async () => {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  return membership;
});
