"use server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { invitationDigest } from "@/lib/institution/invitation-token";
export async function acceptInstitutionInvitation(token: string, _previous: { message: string }, form: FormData): Promise<{ message: string }> {
 const { userId } = await auth();
 if (!userId || form.get('confirm') !== 'yes') return { message: "Sign in and confirm that you want to join this institution." };
 let organizationId: string | undefined;
 try {
  const digest = invitationDigest(token), user = await currentUser();
  if (!user || user.id !== userId) return { message: "Your session expired. Please sign in again." };
  const db = createJoinSupabaseClient();
  for (const email of user.emailAddresses.filter(item => item.verification?.status === 'verified')) {
   const result = await db.rpc('institution_accept_invitation', { p_token_hash: digest, p_user_id: userId, p_verified_email: email.emailAddress });
   if (!result.error && z.uuid().safeParse(result.data).success) { organizationId = result.data!; break; }
  }
  if (!organizationId) return { message: "This invitation is expired, revoked or belongs to a different verified email. Ask your institution administrator for a new invitation." };
  (await cookies()).set('queuezero-business', organizationId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
 } catch { return { message: "The invitation could not be accepted. Check your connection and try again." }; }
 redirect('/dashboard/units');
}
