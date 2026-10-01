import Link from "next/link";
export default function QueueNotFound() {
  return <><h1 className="text-3xl font-semibold">Queue unavailable</h1><p className="mt-4 text-muted">This queue doesn’t exist or isn’t accessible in your current workspace.</p><Link href="/dashboard/queues" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-semibold text-white">Back to queues</Link></>;
}
