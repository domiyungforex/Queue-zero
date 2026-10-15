import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <AuthShell title="Welcome back" description="Sign in to your TuRnMaRk account.">
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
