"use client";
import Link from "next/link";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isServerError = error.message?.includes("Minified React error") || error.message?.includes("Server Components");
  const message = isServerError
    ? "We couldn’t load this workspace. Your session may have expired or the workspace data is unavailable."
    : error.message || "We couldn’t load this workspace.";

  return (
    <div role="alert" style={{ maxWidth: 480, margin: "80px auto", padding: 32, textAlign: "center" }}>
      <h1 className="text-2xl font-semibold">We couldn’t load this workspace</h1>
      <p className="my-4 text-muted">{message}</p>
      {error.digest ? <p className="my-2 text-xs text-muted">Reference: {error.digest}</p> : null}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
        <button onClick={reset} className="min-h-12 rounded-lg bg-primary px-6 text-white">Try again</button>
        <Link href="/onboarding" className="min-h-12 rounded-lg border border-black/15 px-6 py-3 text-sm font-semibold">
          Set up workspace
        </Link>
        <Link href="/sign-in" className="min-h-12 rounded-lg border border-black/15 px-6 py-3 text-sm font-semibold">
          Sign in again
        </Link>
      </div>
    </div>
  );
}