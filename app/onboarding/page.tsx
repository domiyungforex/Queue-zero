import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PageShell } from "@/components/ui/page-shell";
import { getCurrentMembership } from "@/lib/business/membership";
import { COUNTRY_CODES } from "@/lib/validation/onboarding";
import { onboardBusiness } from "./actions";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  if (await getCurrentMembership()) redirect("/dashboard");
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const countries = COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const timezones = Array.from(new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]));

  return (
    <PageShell title="Let’s set up your business">
      <p className="mb-8 max-w-xl leading-relaxed text-muted">Create your business and its first location to get started with QueueZero.</p>
      <OnboardingForm action={onboardBusiness} countries={countries} timezones={timezones} />
    </PageShell>
  );
}
