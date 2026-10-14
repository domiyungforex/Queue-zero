import "server-only";
import { cache } from "react";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getProfessionalWorkspaceProfile = cache(async () => {
  const membership = await requireBusinessMembership();
  if (membership.workspaceOwnership !== "INDIVIDUAL" || !membership.professionalCategory) {
    return null;
  }
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("professional_workspace_profiles")
    .select("professional_category,teaching_level,institution_name,service_name,practice_location_id,locations!professional_workspace_profil_practice_location_id_busines_fkey(name,address)")
    .eq("business_id", membership.businessId)
    .maybeSingle();
  if (error) throw new Error("We couldn’t load your professional workspace. Please try again.");
  return data;
});
