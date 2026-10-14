"use server";
import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";
import { getInstitutionSnapshot } from "./data";
import { invitationDigest, invitationToken, readImportPreview, signImportPreview } from "./invitation-token";
import { scheduleInstitutionInvitations } from "./invitation-delivery";
import { previewStaffCsv, staffInvitationSchema, type ImportRow, type StaffInvitation } from "./staff-import";
export type InviteState = { ok: boolean; message: string; id?: string; url?: string };
export type ImportState = { ok: boolean; message: string; rows?: ImportRow[]; confirmation?: string; ready?: number; existing?: number };
const confirmationSchema = z.object({ organizationId: z.uuid(), expiresAt: z.number().int(), invitations: z.array(staffInvitationSchema).min(1).max(200) });
async function commitInvitations(organizationId: string, invitations: StaffInvitation[]) {
 const db = await createUserSupabaseClient();
 const result = await db.rpc("institution_invite_batch", { p_organization_id: organizationId, p_invitations: invitations.map(row => ({ ...row, token_hash: invitationDigest(invitationToken(row.request_id)) })) });
 if (result.error) throw new Error("Invitations could not be created. Your access, unit or account limits may have changed.");
 scheduleInstitutionInvitations();
 revalidatePath("/dashboard/people");
}
export async function inviteInstitutionStaff(_previous: InviteState, form: FormData): Promise<InviteState> {
 const membership = await requireBusinessMembership();
 const parsed = staffInvitationSchema.safeParse({ request_id: form.get('request_id') || randomUUID(), unit_id: form.get('unit_id'), email: form.get('email'), role: form.get('role'), staff_title: form.get('staff_title') ?? '', permissions: form.getAll('permissions') });
 if (!parsed.success) return { ok: false, message: "Check the invitation email, unit, role and permissions." };
 try {
  await commitInvitations(membership.businessId, [parsed.data]);
  return { ok: true, message: "Invitation saved and queued for email delivery. You can also share this private link with the named recipient.", id: parsed.data.request_id, url: new URL(`/invitations/${invitationToken(parsed.data.request_id)}`, publicEnv.NEXT_PUBLIC_APP_URL).href };
 } catch { return { ok: false, message: "Invitation could not be saved. Check your permission and the current unit, then try again." }; }
}
export async function previewStaffImport(_previous: ImportState, form: FormData): Promise<ImportState> {
 const membership = await requireBusinessMembership();
 try {
  const { snapshot } = await getInstitutionSnapshot();
  const raw = form.get('csv'); if (typeof raw !== 'string') return { ok: false, message: "Paste the staff CSV to preview it." };
  const rows = previewStaffCsv(raw, snapshot.units);
  const valid = rows.filter(row => row.input);
  if (valid.length) {
   const clerk = await clerkClient();
   const emails = [...new Set(valid.map(row => row.input!.email))];
   const users = await clerk.users.getUserList({ emailAddress: emails, limit: 200 });
   const existing = new Set(users.data.flatMap(user => user.emailAddresses.filter(address => address.verification?.status === 'verified').map(address => address.emailAddress.toLowerCase())));
   for (const row of valid) if (existing.has(row.input!.email)) row.status = 'EXISTING';
  }
  const invitations = valid.map(row => ({ ...row.input!, request_id: randomUUID() }));
  const confirmation = invitations.length ? signImportPreview({ organizationId: membership.businessId, expiresAt: Date.now() + 20 * 60_000, invitations }) : undefined;
  return { ok: true, message: "Review every row. Only ready and existing-account rows will be invited after you confirm.", rows, confirmation, ready: valid.filter(row => row.status === 'READY').length, existing: valid.filter(row => row.status === 'EXISTING').length };
 } catch (error) {
  const message = error instanceof Error && /^(Import at most|Check the CSV|Row \d|Use the header|Include between)/.test(error.message) ? error.message : "The import could not be verified. Check your access and connection, then try again.";
  return { ok: false, message };
 }
}
export async function confirmStaffImport(_previous: ImportState, form: FormData): Promise<ImportState> {
 const membership = await requireBusinessMembership();
 try {
  if (form.get('confirm') !== 'yes') return { ok: false, message: "Confirm the reviewed invitations before importing." };
  const token = form.get('confirmation'); if (typeof token !== 'string') throw new Error('Missing preview');
  const parsed = confirmationSchema.parse(readImportPreview(token));
  if (parsed.organizationId !== membership.businessId || parsed.expiresAt <= Date.now()) return { ok: false, message: "This preview expired or belongs to another institution. Preview the CSV again." };
  await commitInvitations(membership.businessId, parsed.invitations);
  return { ok: true, message: `${parsed.invitations.length} invitations saved and queued for email delivery. Existing accounts will keep their current identity.` };
 } catch { return { ok: false, message: "The import was not confirmed. Check your permissions and preview the CSV again." }; }
}
export async function revokeInstitutionInvitation(_previous: InviteState, form: FormData): Promise<InviteState> {
 const membership = await requireBusinessMembership();
 const parsed = z.uuid().safeParse(form.get('invitation_id'));
 if (!parsed.success) return { ok: false, message: "Invalid invitation." };
 try {
  const db = await createUserSupabaseClient();
  const { data: permission } = await db.rpc('institution_snapshot', { p_organization_id: membership.businessId });
  const ids = z.object({ invitations: z.array(z.object({ id: z.uuid() })) }).safeParse(permission);
  if (!ids.success || !ids.data.invitations.some(row => row.id === parsed.data)) return { ok: false, message: "Invitation unavailable in this institution." };
  const result = await db.rpc('institution_revoke_invitation', { p_invitation_id: parsed.data });
  if (result.error) throw new Error('Unavailable');
  revalidatePath('/dashboard/people');
  return { ok: true, message: "Invitation revoked. Its link can no longer grant access." };
 } catch { return { ok: false, message: "Invitation could not be revoked. Reload and try again." }; }
}
