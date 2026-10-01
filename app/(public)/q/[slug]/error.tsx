"use client";

import { PublicQueueShell } from "@/components/customer/public-queue-shell";
export default function PublicQueueError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PublicQueueShell><div role="alert"><h1 className="text-3xl font-semibold">We couldn’t load this queue</h1><p className="mt-4 leading-relaxed text-muted">Check your connection and try again. If this continues, please ask staff for help.</p></div><button onClick={reset} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-6 py-3 font-semibold text-white">Try again</button></PublicQueueShell>;
}
