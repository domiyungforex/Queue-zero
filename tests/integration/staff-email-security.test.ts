import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ users: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: async () => ({ users: { getUserList: mocks.users } }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('@/lib/business/membership', () => ({ requireBusinessManager: async () => ({ businessId: 'business-owner' }), requireBusinessOwner: vi.fn() }));
vi.mock('@/lib/db/server', () => ({ createUserSupabaseClient: async () => ({ rpc: mocks.rpc }) }));
import { saveTeamMember } from '@/app/dashboard/settings/actions';
const form = () => { const f = new FormData(); f.set('email', 'staff@example.com'); f.set('role', 'staff'); return f; };
beforeEach(() => { mocks.rpc.mockResolvedValue({ error: null }); });
it.each(['unverified', 'expired', null])('does not grant access to an email with verification status %s', async status => {
  mocks.users.mockResolvedValue({ data: [{ id: 'user_attacker', emailAddresses: [{ emailAddress: 'staff@example.com', verification: status ? { status } : null }] }] });
  expect((await saveTeamMember({ ok: false, message: '' }, form())).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('requires the requested email itself to be verified', async () => {
  mocks.users.mockResolvedValue({ data: [{ id: 'user_attacker', emailAddresses: [{ emailAddress: 'other@example.com', verification: { status: 'verified' } }, { emailAddress: 'staff@example.com', verification: { status: 'unverified' } }] }] });
  expect((await saveTeamMember({ ok: false, message: '' }, form())).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('adds the intended account when its matching email is verified', async () => {
  mocks.users.mockResolvedValue({ data: [{ id: 'user_staff', emailAddresses: [{ emailAddress: 'Staff@Example.com', verification: { status: 'verified' } }] }] });
  expect((await saveTeamMember({ ok: false, message: '' }, form())).ok).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith('save_staff', expect.objectContaining({ p_user_id: 'user_staff', p_business_id: 'business-owner' }));
});
