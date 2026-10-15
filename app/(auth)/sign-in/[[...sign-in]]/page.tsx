import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { publicEnv } from "@/lib/env";
import { safeAuthReturn } from "@/lib/school-student/return-url";

export const metadata: Metadata = { title: "Sign in" };

type PageProps = { searchParams?: Promise<{ redirect_url?: string | string[] }> };

export default async function Page({ searchParams }: PageProps = {}) {
  const { userId } = await auth();
  if (userId) {
    const redirectUrl = (await searchParams)?.redirect_url;
    redirect(safeAuthReturn(typeof redirectUrl === "string" ? redirectUrl : null, "/dashboard", publicEnv.NEXT_PUBLIC_APP_URL));
  }

  return (
    <AuthShell title="Welcome back" description="Sign in to your TuRnMaRk account.">
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
