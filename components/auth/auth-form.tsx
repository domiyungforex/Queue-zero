"use client";

import { useEffect,useState } from "react";
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [slow,setSlow]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setSlow(true),12000);return()=>clearTimeout(timer)},[]);
  return (
    <div className="flex min-h-80 w-full justify-center">
      <ClerkLoading>
        <div className="auth-loading" role="status">{slow?<><p>Secure sign-in is taking longer than expected.</p><p>Please try again shortly. You can still explore QueueZero.</p><button className="button-secondary" onClick={()=>window.location.reload()}>Try again</button><a href="/demo" className="button-quiet">Explore the demo workspace</a></>:<><span className="loading-pulse"/><p>Loading secure sign-in…</p></>}</div>
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
