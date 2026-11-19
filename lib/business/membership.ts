import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/server";
import { WorkspaceUnavailable } from "@/lib/business/workspace-access";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getMemberships = cache(async () => {
  const userId = await requireUserId();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("business_members")
    .select("business_id,role,businesses!business_members_business_id_fkey(name,organization_mode,institution_type,workspace_ownership,professional_category,organization_type,onboarding_completed_at)")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) {
    console.error("getMemberships failed", { code: error.code, message: error.message });
    throw new WorkspaceUnavailable();
  }
  return (data ?? []).flatMap((membership) => {
    if (!membership.businesses) return [];
    return [{
      businessId: membership.business_id,
      role: membership.role,
      businessName: membership.businesses.name,
      workspaceOwnership: membership.businesses.workspace_ownership,
      ...(membership.businesses.organization_mode ? { organizationMode: membership.businesses.organization_mode } : {}),
      ...(membership.businesses.institution_type ? { institutionType: membership.businesses.institution_type } : {}),
      ...(membership.businesses.professional_category ? { professionalCategory: membership.businesses.professional_category } : {}),
      ...(membership.businesses.organization_type ? { organizationType: membership.businesses.organization_type } : {}),
      ...(membership.businesses.onboarding_completed_at ? { onboardingCompletedAt: membership.businesses.onboarding_completed_at } : {}),
    }];
  });
});

export const getCurrentMembership = cache(async () => {
  const memberships = await getMemberships();
  const selected = (await cookies()).get("queuezero-business")?.value;
  // A cookie is a preference, never authorization. Revoked/stale selections fall back safely.
  return memberships.find((membership) => membership.businessId === selected) ?? memberships[0] ?? null;
});

// Deliberately not cached: workspace switching must validate the exact target
// against the current database membership immediately before changing the
// preference cookie. The next dashboard request validates it again.
export async function getWorkspaceMembership(businessId: string) {
  const userId = await requireUserId();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("business_members")
    .select("business_id,role,businesses!business_members_business_id_fkey(name,organization_mode,institution_type,workspace_ownership,professional_category,organization_type,onboarding_completed_at)")
    .eq("clerk_user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error("We couldn’t verify that workspace. Please try again.");
  if (!data) return null;
  if (!data.businesses) throw new Error("Your workspace is temporarily unavailable.");
  return {
    businessId: data.business_id,
    role: data.role,
    businessName: data.businesses.name,
    workspaceOwnership: data.businesses.workspace_ownership,
    ...(data.businesses.organization_mode ? { organizationMode: data.businesses.organization_mode } : {}),
    ...(data.businesses.institution_type ? { institutionType: data.businesses.institution_type } : {}),
    ...(data.businesses.professional_category ? { professionalCategory: data.businesses.professional_category } : {}),
    ...(data.businesses.organization_type ? { organizationType: data.businesses.organization_type } : {}),
    ...(data.businesses.onboarding_completed_at ? { onboardingCompletedAt: data.businesses.onboarding_completed_at } : {}),
  };
}

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
