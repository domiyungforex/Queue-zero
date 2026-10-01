import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <PageShell title="Welcome back">
      <p className="mb-8 text-muted">Sign in to your QueueZero business account.</p>
      <AuthForm mode="sign-in" />
    </PageShell>
  );
}
