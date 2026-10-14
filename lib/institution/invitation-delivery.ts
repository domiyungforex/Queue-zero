import "server-only";
import { after } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { publicEnv } from "@/lib/env";
import { invitationToken } from "./invitation-token";
import { z } from "zod";

/** Durable SQL leases keep delivery outside queue/attendance transactions. */
export async function deliverInstitutionInvitations() {
 const db = createJoinSupabaseClient();
 const claimed = await db.rpc("institution_claim_invitation_delivery", { p_limit: 10 });
 if (claimed.error) throw new Error("Invitation delivery unavailable");
 const rows = z.array(z.object({ id: z.uuid(), email: z.email() })).parse(claimed.data);
 let sent = 0, failed = 0;
 const clerk = await clerkClient();
 for (const row of rows) {
  let providerId: string | null = null;
  try {
   const url = new URL(`/invitations/${invitationToken(row.id)}`, publicEnv.NEXT_PUBLIC_APP_URL);
   const invitation = await clerk.invitations.createInvitation({ emailAddress: row.email, redirectUrl: url.href, ignoreExisting: true, notify: true, expiresInDays: 7 });
   providerId = invitation.id;
  } catch { /* Do not log invite tokens, email addresses or provider payloads. */ }
  const finished = await db.rpc("institution_finish_invitation_delivery", { p_invitation_id: row.id, p_success: providerId !== null, p_provider_id: providerId ?? undefined });
  if (finished.error) { failed++; continue; }
  if (providerId) sent++; else failed++;
 }
 return { sent, failed };
}
export function scheduleInstitutionInvitations() {
 try { after(async () => { try { await deliverInstitutionInvitations(); } catch { console.warn("Institution invitation delivery deferred; jobs retained"); } }); }
 catch { console.warn("Institution invitation worker unavailable; jobs retained"); }
}
