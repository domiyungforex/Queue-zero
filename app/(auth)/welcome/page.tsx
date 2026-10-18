import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PhaseOneAuth } from "@/components/auth/phase-one-auth";
export const metadata: Metadata = { title: "Welcome" };
export default async function WelcomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return <Suspense fallback={<main className="min-h-dvh bg-[#FFFAF7]" />}><PhaseOneAuth initial="welcome" /></Suspense>;
}
