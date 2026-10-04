"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { ONBOARDING_FIELDS, onboardingSchema, type OnboardingState, type OnboardingValues } from "@/lib/validation/onboarding";

export async function onboardBusiness(_previous: OnboardingState, formData: FormData): Promise<OnboardingState> {
  await requireUserId();
  const values = Object.fromEntries(ONBOARDING_FIELDS.map((field) => {
    const value = formData.get(field);
    return [field, typeof value === "string" ? value : ""];
  })) as OnboardingValues;
  const organizationMode = formData.get("organizationMode");
  if (organizationMode !== null) values.organizationMode = typeof organizationMode === "string" ? organizationMode : "";
  const parsed = onboardingSchema.safeParse(values);
  // Bound values echoed after a malicious oversized submission; normal form
  // values remain intact on both validation and infrastructure failures.
  const retainedValues = Object.fromEntries(ONBOARDING_FIELDS.map((field) => [field, values[field].slice(0, 1000)])) as OnboardingValues;
  if (values.organizationMode !== undefined) retainedValues.organizationMode = values.organizationMode.slice(0, 100);
  if (!parsed.success) {
    return { status: "error", message: "Please check the highlighted fields.", values: retainedValues, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const db = await createUserSupabaseClient();
    const input = parsed.data;
    const parameters = {
      p_business_name: input.businessName,
      p_industry: input.industry,
      p_country_code: input.country,
      p_timezone: input.timezone,
      p_location_name: input.locationName,
      p_location_address: input.locationAddress,
    };
    const { data, error } = (!input.organizationMode || input.organizationMode === "BUSINESS")
      ? await db.rpc("onboard_business", parameters)
      : await db.rpc("onboard_organization", { ...parameters, p_mode: input.organizationMode });
    if (error || !z.uuid().safeParse(data).success) {
      return { status: "error", message: "We couldn’t finish setting up your business. Please try again.", values: retainedValues };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: "We couldn’t finish setting up your business. Please try again.", values: retainedValues };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
