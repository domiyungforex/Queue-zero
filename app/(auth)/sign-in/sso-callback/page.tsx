"use client";

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { safeAuthReturn } from "@/lib/school-student/return-url";
import { publicEnv } from "@/lib/env";

function OAuthCallbackContent() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const search = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState("");

  const returnTo = safeAuthReturn(
    search.get("redirect_url"),
    "/dashboard",
    publicEnv.NEXT_PUBLIC_APP_URL,
  );

  useEffect(() => {
    if (!clerk.loaded || started.current) return;
    started.current = true;

    const continueAt = (mode: "sign-in" | "sign-up") => {
      const query = new URLSearchParams({
        redirect_url: returnTo,
        oauth: "continue",
      });
      router.replace(`/${mode}?${query.toString()}`);
    };

    const navigate = ({ session, decorateUrl }: { session: { currentTask?: unknown } | null; decorateUrl: (url: string) => string }) => {
      // Let the existing Clerk UI handle any required session task.
      if (session?.currentTask) {
        continueAt("sign-in");
        return;
      }
      window.location.assign(decorateUrl(returnTo));
    };

    void (async () => {
      try {
        if (signIn.status === "complete") {
          await signIn.finalize({ navigate });
          return;
        }

        if (signUp.status === "complete") {
          await signUp.finalize({ navigate });
          return;
        }

        // Clerk can transfer an OAuth attempt to sign-up when no account exists,
        // or back to sign-in when the identity belongs to an existing account.
        if (signUp.isTransferable) {
          const { error: transferError } = await signIn.create({ transfer: true });
          if (transferError) throw transferError;
          if (signIn.status === "complete") {
            await finalize(signIn);
            return;
          }
        }

        if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
          continueAt("sign-in");
          return;
        }

        if (signUp.status === "missing_requirements") {
          continueAt("sign-up");
          return;
        }

        // Route unresolved Clerk states to its built-in continuation UI rather
        // than leaving users on a blank callback page.
        continueAt("sign-in");
      } catch {
        setError("Google sign-in couldn't be completed. Please try again.");
        started.current = false;
      }
    })();
  }, [clerk.loaded, returnTo, router, signIn, signUp]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Couldn’t finish signing in</h1>
        <p className="text-sm text-neutral-600">{error}</p>
        <button
          type="button"
          className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
          onClick={() => router.replace(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`)}
        >
          Back to sign in
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6" aria-live="polite">
      <p className="text-sm text-neutral-600">Completing secure Google sign-in…</p>
    </main>
  );
}

export default function GoogleSSOCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center px-6">
          <p className="text-sm text-neutral-600">Loading secure sign-in…</p>
        </main>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
