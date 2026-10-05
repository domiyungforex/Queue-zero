"use client";

import Link from "next/link";
import { Suspense } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { safeAuthReturn } from "@/lib/school-student/return-url";

function ClerkAuth({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isSignedIn } = useAuth();
  const search = useSearchParams();

  const returnTo = safeAuthReturn(
    search.get("redirect_url"),
    mode === "sign-up" ? "/onboarding" : "/dashboard",
  );

  if (isSignedIn) {
    return (
      <Link className="button-primary w-full" href={returnTo}>
        Continue to QueueZero
      </Link>
    );
  }

  return mode === "sign-in" ? (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`}
      forceRedirectUrl={returnTo}
      fallbackRedirectUrl={returnTo}
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full shadow-none",
          card: "w-full shadow-none border-0 bg-transparent p-0",
          headerTitle: "hidden",
          headerSubtitle: "hidden",
          footer: "hidden",
        },
      }}
    />
  ) : (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}
      forceRedirectUrl={returnTo}
      fallbackRedirectUrl={returnTo}
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full shadow-none",
          card: "w-full shadow-none border-0 bg-transparent p-0",
          headerTitle: "hidden",
          headerSubtitle: "hidden",
          footer: "hidden",
        },
      }}
    />
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <Suspense fallback={<p role="status">Loading secure sign-in…</p>}>
      <ClerkAuth mode={mode} />
    </Suspense>
  );
}
