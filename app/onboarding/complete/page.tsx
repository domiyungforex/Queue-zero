import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell, SuccessPanel } from "@/components/onboarding/onboarding-ui";
import { getCurrentMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { OnboardingCompletionAnalytics } from "@/components/analytics/onboarding-completion";

export const metadata: Metadata = { title: "Workspace created", description: "Your TuRnMaRk workspace setup result." };

export default async function OnboardingCompletePage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  if (!membership.onboardingCompletedAt) redirect("/dashboard");
  const organization = membership.workspaceOwnership === "ORGANIZATION";
  let pendingVerification = false;
  if (organization) {
    const db = await createUserSupabaseClient();
    const { data, error } = await db.from("organization_workspace_profiles").select("verification_status").eq("business_id", membership.businessId).maybeSingle();
    if (error || !data) throw new Error("The workspace was created, but its verification state could not be confirmed.");
    pendingVerification = data.verification_status !== "VERIFIED";
  }
  return <OnboardingShell><OnboardingCompletionAnalytics accountType={organization ? "ORGANIZATION" : "INDIVIDUAL"} workspaceType={organization ? "ORGANIZATION" : "INDIVIDUAL"} /><SuccessPanel name={membership.businessName} organization={organization} pendingVerification={pendingVerification}/></OnboardingShell>;
}
