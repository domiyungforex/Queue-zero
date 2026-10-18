import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PhaseOneAuth } from "@/components/auth/phase-one-auth";
import { publicEnv } from "@/lib/env";
import { safeAuthReturn } from "@/lib/school-student/return-url";
export const metadata: Metadata = { title: "Sign in" };
type PageProps = { searchParams?: Promise<{ redirect_url?: string | string[] }> };
export default async function Page({ searchParams }: PageProps = {}) {
  const { userId } = await auth();
  if (userId) {
    const value = (await searchParams)?.redirect_url;
    redirect(safeAuthReturn(typeof value === "string" ? value : null, "/dashboard", publicEnv.NEXT_PUBLIC_APP_URL));
  }
  return <Suspense fallback={<main className="min-h-dvh bg-[#FFFAF7]" />}><PhaseOneAuth initial="email" /></Suspense>;
}
