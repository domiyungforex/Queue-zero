import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PageShell } from "@/components/ui/page-shell";
import { getCurrentMembership } from "@/lib/business/membership";
import { COUNTRY_CODES } from "@/lib/validation/onboarding";
import { onboardBusiness } from "./actions";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function OnboardingPage(props?: { searchParams?: Promise<{ new?: string | string[] }> }) {
  const searchParams = props?.searchParams;
  const membership = await getCurrentMembership();
  const query = await searchParams;
  if (membership && query?.new !== "workspace") redirect("/dashboard");
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const countries = COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const timezones = Array.from(new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]));

  return (
    <PageShell title="Create your TuRnMaRk workspace">
      <p className="mb-8 max-w-2xl leading-relaxed text-muted">Choose a personal workspace for your own work or set up TuRnMaRk for an organization. Your account stays the same either way.</p>
      <OnboardingForm action={onboardBusiness} countries={countries} timezones={timezones} requestId={randomUUID()} />
    </PageShell>
  );
}
