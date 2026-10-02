import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), plan: vi.fn(), paystack: vi.fn(), insert: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.user }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('@/lib/business/membership', () => ({ requireBusinessOwner: async () => ({ businessId: 'owned-business' }) }));
vi.mock('@/lib/paystack/server', () => ({ getPaidPlan: mocks.plan, paystack: mocks.paystack }));
vi.mock('@/lib/db/join-server', () => ({ createJoinSupabaseClient: () => ({ from: () => ({ insert: mocks.insert }) }) }));
import { startCheckout } from '@/app/dashboard/billing/actions';
beforeEach(() => {
  mocks.plan.mockResolvedValue({ plan_code: 'PLN_fixture', amount: 10000, currency: 'NGN' });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.paystack.mockResolvedValue({ authorization_url: 'https://checkout.paystack.com/fixture' });
});
it('does not send an unverified primary email to the payment provider', async () => {
  mocks.user.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'victim@example.com', verification: { status: 'unverified' } } });
  expect((await startCheckout('STARTER')).error).toContain('verified email');
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.paystack).not.toHaveBeenCalled();
});
it('starts an owner checkout using a verified primary email', async () => {
  mocks.user.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'owner@example.com', verification: { status: 'verified' } } });
  expect((await startCheckout('STARTER')).url).toBe('https://checkout.paystack.com/fixture');
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ business_id: 'owned-business' }));
});
