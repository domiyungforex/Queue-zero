import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <PageShell title="Create your business account">
      <p className="mb-8 text-muted">Customers joining a queue never need an account.</p>
      <AuthForm mode="sign-up" />
    </PageShell>
  );
}
