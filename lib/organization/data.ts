import "server-only";
import { cache } from "react";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";

export const getOrganizationWorkspaceProfile = cache(async () => {
  const membership = await requireBusinessMembership();
  if (membership.workspaceOwnership !== "ORGANIZATION" || !membership.organizationType) return null;
  const db = await createUserSupabaseClient();
  const { data, error } = await db.from("organization_workspace_profiles")
    .select("organization_type,organization_subtype,legal_name,service_templates,verification_status,setup_completed_at")
    .eq("business_id", membership.businessId)
    .maybeSingle();
  if (error) {
    console.error("organization profile failed", { code: error.code, message: error.message });
    return null;
  }
  return data;
});
