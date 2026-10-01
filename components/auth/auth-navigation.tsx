"use client";

import { ClerkFailed, ClerkLoaded, ClerkLoading, Show, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";

const linkClass = "inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium";

export function AuthNavigation() {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      setSignOutError("Couldn’t sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <ClerkLoading>
        <span className="px-3 text-sm text-muted" role="status">Loading account…</span>
      </ClerkLoading>
      <ClerkFailed>
        <Link href="/sign-in" className={linkClass}>Account unavailable</Link>
      </ClerkFailed>
      <ClerkLoaded>
        <Show when="signed-out">
          <Link href="/sign-in" className={linkClass}>Sign in</Link>
          <Link href="/sign-up" className={`${linkClass} bg-primary text-white`}>Get started</Link>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard" prefetch={false} className={linkClass}>Dashboard</Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-busy={signingOut}
            className={`${linkClass} cursor-pointer border border-black/15 disabled:cursor-wait disabled:opacity-60`}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {signOutError && <p role="alert" className="w-full text-sm">{signOutError}</p>}
        </Show>
      </ClerkLoaded>
    </div>
  );
}
