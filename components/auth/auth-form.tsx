"use client";

import { Suspense, useEffect } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { safeAuthReturn } from "@/lib/school-student/return-url";

function ClerkAuth({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  const returnTo = safeAuthReturn(
    search.get("redirect_url"),
    mode === "sign-up" ? "/onboarding" : "/dashboard",
  );

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace(returnTo);
  }, [isLoaded, isSignedIn, returnTo, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <div className="auth-transition" role="status" aria-live="polite">
        <span className="loading-pulse" />
        <p>{isSignedIn ? "Opening your workspace…" : "Loading secure account access…"}</p>
      </div>
    );
  }

  const appearance = {
    elements: {
      rootBox: "w-full",
      cardBox: "w-full shadow-none",
      card: "w-full shadow-none border-0 bg-transparent p-0",
      headerTitle: "hidden",
      headerSubtitle: "hidden",
      socialButtonsBlockButton: "min-h-12 rounded-xl",
      formFieldInput: "min-h-12 rounded-xl",
      formButtonPrimary: "min-h-12 rounded-full font-semibold normal-case",
      footer: "hidden",
    },
  };

  return mode === "sign-in" ? (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`}
      forceRedirectUrl={returnTo}
      fallbackRedirectUrl={returnTo}
      appearance={appearance}
    />
  ) : (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}
      forceRedirectUrl={returnTo}
      fallbackRedirectUrl={returnTo}
      appearance={appearance}
    />
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <Suspense fallback={<p role="status">Loading secure account access…</p>}>
      <ClerkAuth mode={mode} />
    </Suspense>
  );
}
