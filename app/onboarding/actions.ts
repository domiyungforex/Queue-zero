"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { ONBOARDING_FIELDS, ORGANIZATION_TYPES, onboardingSchema, type OnboardingState, type OnboardingValues } from "@/lib/validation/onboarding";

export async function onboardBusiness(_previous: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const userId = await requireUserId();
  const values = Object.fromEntries(ONBOARDING_FIELDS.map((field) => {
    const value = formData.get(field);
    return [field, typeof value === "string" ? value : ""];
  })) as OnboardingValues;
  const parsed = onboardingSchema.safeParse(values);
  // Bound values echoed after a malicious oversized submission; normal form
  // values remain intact on both validation and infrastructure failures.
  const retainedValues = Object.fromEntries(ONBOARDING_FIELDS.map((field) => [field, values[field].slice(0, 1000)])) as OnboardingValues;
  if (!parsed.success) {
    return { status: "error", message: "Please check the highlighted fields.", values: retainedValues, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const db = await createUserSupabaseClient();
    const input = parsed.data;
    let result: { data: string | null; error: unknown };
    if (input.accountType === "INDIVIDUAL") {
      result = await db.rpc("onboard_professional_workspace_v2", {
        p_workspace_name: input.workspaceName,
        p_professional_category: input.professionalCategory,
        p_country_code: input.country,
        p_timezone: input.timezone,
        p_teaching_level: input.teachingLevel || undefined,
        p_institution_name: input.institutionName || undefined,
        p_service_name: input.serviceName || undefined,
        p_location_name: input.locationName || undefined,
        p_location_address: input.locationAddress || undefined,
      });
    } else {
      const organizationType = ORGANIZATION_TYPES.find(({ value }) => value === input.organizationType);
      if (!organizationType) {
        return { status: "error", message: "Please check the highlighted fields.", values: retainedValues, fieldErrors: { organizationType: ["Choose an organization type."] } };
      }
      const parameters = {
        p_request_id: input.onboardingRequestId,
        p_workspace_name: input.workspaceName,
        p_organization_type: organizationType.value,
        p_country_code: input.country,
        p_timezone: input.timezone,
        p_location_name: input.locationName,
        p_location_address: input.locationAddress,
      };
      // Map new organization types to the closest existing enum value the RPC currently accepts.
      // After the 20261117000000 migration is applied, the enum accepts the new values directly.
      const legacyTypeMap: Record<string, string> = {
        BUSINESS: "COMPANY_OTHER", SCHOOL: "UNIVERSITY_SCHOOL", UNIVERSITY: "UNIVERSITY_SCHOOL",
        HOSPITAL: "HOSPITAL_CLINIC", CLINIC: "HOSPITAL_CLINIC", GOVERNMENT: "GOVERNMENT_OFFICE",
        CORPORATE: "COMPANY_OTHER", EVENT_ORGANIZER: "COMPANY_OTHER",
        CONFERENCE_ORGANIZER: "COMPANY_OTHER", NONPROFIT: "COMPANY_OTHER", OTHER: "COMPANY_OTHER",
      };
      const rpcType = (legacyTypeMap[organizationType.value] ?? organizationType.value) as
        "UNIVERSITY_SCHOOL" | "HOSPITAL_CLINIC" | "BANK_FINANCIAL" | "SALON_BARBERSHOP" | "GOVERNMENT_OFFICE" | "COMPANY_OTHER";
      result = await db.rpc("onboard_organization_workspace_v2", {
        ...parameters,
        p_organization_type: rpcType,
        p_organization_subtype: input.organizationSubtype,
        p_legal_name: input.legalName,
        // The generated RPC type is non-null because PostgreSQL parameters do
        // not expose nullability. The function normalizes an empty value to
        // NULL for categories that do not require a representative.
        p_authorized_representative_name: input.representativeName,
        p_service_templates: input.serviceTemplates.split(",").filter(Boolean),
      });
    }
    const { data, error } = result;
    const workspaceId = z.uuid().safeParse(data);
    if (error || !workspaceId.success) {
      console.error("Onboarding RPC failed", { error, data });
      const detail = error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : null;
      return { status: "error", message: detail && detail.length < 200 ? detail : "We couldn’t finish setting up your workspace. Please try again.", values: retainedValues };
    }
    const { data: membership, error: membershipError } = await db.from("business_members")
      .select("business_id")
      .eq("business_id", workspaceId.data)
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (membershipError || membership?.business_id !== workspaceId.data) {
      return { status: "error", message: "Your workspace was saved, but we couldn’t open it yet. Please try again.", values: retainedValues };
    }
    (await cookies()).set("queuezero-business", workspaceId.data, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: "We couldn’t finish setting up your workspace. Please try again.", values: retainedValues };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/onboarding/complete");
}
