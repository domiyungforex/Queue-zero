import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Create your account" };

export default function Page() {
  return (
    <AuthShell title="Create your TuRnMaRk account" description="Use your email address to get started.">
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
