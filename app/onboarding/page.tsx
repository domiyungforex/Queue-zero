import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { OnboardingShell } from "@/components/onboarding/onboarding-ui";

import { getCurrentMembership } from "@/lib/business/membership";
import { COUNTRY_CODES } from "@/lib/validation/onboarding";
import { onboardBusiness } from "./actions";

export const metadata: Metadata = { title: "Set up your workspace", description: "Create an individual or organization TuRnMaRk workspace." };

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
    <OnboardingShell>
      <OnboardingForm action={onboardBusiness} countries={countries} timezones={timezones} requestId={randomUUID()} />
    </OnboardingShell>
    <main className="min-h-[100dvh] bg-[#FFFAF7] px-4 py-8 text-[#111318] sm:px-8 sm:py-12">\n      <div className="mx-auto mb-8 max-w-4xl"><p className="text-xl font-extrabold tracking-tight">TuRn<span className="text-[#FF6B2B]">MaRk</span></p><h1 className="mt-8 text-3xl font-extrabold tracking-tight">Create your workspace</h1><p className="mt-2 text-sm text-[#73788A]">Set up your personal workspace or an organization workspace to start using TuRnMaRk.</p></div>\n      <div className="mx-auto max-w-4xl">
      <OnboardingForm action={onboardBusiness} countries={countries} timezones={timezones} requestId={randomUUID()} />
      </div>\n    </main>
  );
}
