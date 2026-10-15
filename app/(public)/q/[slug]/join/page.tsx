import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPublicJoinOptions } from "@/lib/queue/join";
import { CUSTOMER_COOKIE, customerSessionSchema } from "@/lib/security/customer-session";
import { joinQueue } from "@/app/(public)/q/[slug]/join/actions";
import { PublicQueueShell } from "@/components/customer/public-queue-shell";
import { JoinQueueForm } from "@/components/customer/join-queue-form";

export const metadata: Metadata = { title: "Join queue", referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function JoinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ session?: string }> }) {
  const { slug } = await params;
  const options = await getPublicJoinOptions(slug);
  if (!options) notFound();
  if (options.status !== "open") redirect(`/q/${slug}`);
  const session = customerSessionSchema.safeParse((await cookies()).get(CUSTOMER_COOKIE)?.value);
  if (!session.success) {
    // The marker prevents an infinite redirect when cookies are blocked.
    if ((await searchParams).session !== "ready") redirect(`/q/${slug}/join/start`);
    return <PublicQueueShell><h1 className="text-3xl font-semibold">Cookies are needed to join</h1><p className="mt-4 text-muted">Enable cookies for this site to keep your place safe, then reopen the queue link.</p><Link href={`/q/${slug}`} className="mt-6 inline-flex min-h-12 items-center text-primary">Back to queue</Link></PublicQueueShell>;
  }
  return <PublicQueueShell><Link href={`/q/${slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">← Queue details</Link><p className="mt-5 break-words text-muted">{options.business_name}</p><h1 className="mt-2 break-words text-3xl font-semibold">Join {options.queue_name}</h1><p className="mt-2 font-medium text-primary">{options.service_name}</p><p className="mb-7 mt-3 text-muted">Enter your name{options.require_phone ? " and phone number" : ""} to keep your place.</p><JoinQueueForm options={options} action={joinQueue.bind(null, { slug, requestId: randomUUID() })} /></PublicQueueShell>;
}
