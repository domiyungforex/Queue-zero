import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { PageShell } from "@/components/ui/page-shell";
import { InvitationConfirmation } from "./confirmation";
export const metadata: Metadata = { title: 'Join your institution', description: 'Accept a private TuRnMaRk institution invitation with your verified account.', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params;
 if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <PageShell title="Invitation unavailable"><p>This invitation link is invalid. Ask your administrator for a current invitation.</p></PageShell>;
 const { userId } = await auth(); const returnTo = `/invitations/${token}`;
 return <PageShell title="Join your institution">{userId ? <InvitationConfirmation token={token} /> : <div className="space-y-5"><p>Use the verified email your institution invited. Existing members keep their account; new staff create their own account.</p><Link className="button-primary" href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>Sign in to accept</Link><Link className="button-secondary" href={`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`}>Create your account</Link></div>}</PageShell>;
}
