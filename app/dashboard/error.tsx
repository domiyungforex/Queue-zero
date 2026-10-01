"use client";
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert"><h1 className="text-2xl font-semibold">We couldn’t load this workspace</h1><p className="my-4 text-muted">Check your connection and try again.</p><button onClick={reset} className="min-h-12 rounded-lg bg-primary px-6 text-white">Try again</button></div>;
}
