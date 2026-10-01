"use client";

import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="flex min-h-80 w-full justify-center">
      <ClerkLoading>
        <p role="status" className="py-8 text-muted">Loading secure sign-in…</p>
      </ClerkLoading>
      <ClerkFailed>
        <div role="alert" className="max-w-sm rounded-xl border border-black/10 p-6">
          <p className="font-semibold">Sign-in is temporarily unavailable</p>
          <p className="mt-2 text-muted">Please check your connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-white"
          >
            Try again
          </button>
        </div>
      </ClerkFailed>
      <ClerkLoaded>
        {mode === "sign-in" ? (
          <SignIn routing="path" path="/sign-in" />
        ) : (
          <SignUp routing="path" path="/sign-up" />
        )}
      </ClerkLoaded>
    </div>
  );
}
