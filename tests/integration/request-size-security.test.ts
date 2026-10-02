import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), verify: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/join-server', () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/notifications/schedule', () => ({ scheduleNotifications: vi.fn() }));
vi.mock('@/lib/paystack/server', () => ({ verifyCheckout: mocks.verify, paystack: vi.fn() }));
import { POST as subscribe } from '@/app/api/notifications/subscribe/route';
import { POST as webhook } from '@/app/api/webhooks/paystack/route';
afterEach(() => vi.unstubAllEnvs());
it('rejects an oversized push subscription before invoking the privileged database client', async () => {
  const response = await subscribe(new Request('http://localhost:3000/api/notifications/subscribe', { method: 'POST', headers: { origin: 'http://localhost:3000' }, body: 'x'.repeat(8193) }));
  expect(response.status).toBe(413);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects oversized webhook content before signature/payment processing', async () => {
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_fixture');
  const response = await webhook(new Request('http://localhost:3000/api/webhooks/paystack', { method: 'POST', body: 'x'.repeat(131073) }));
  expect(response.status).toBe(413);
  expect(mocks.verify).not.toHaveBeenCalled();
});
it('still rejects unsigned webhook requests', async () => {
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_fixture');
  const response = await webhook(new Request('http://localhost:3000/api/webhooks/paystack', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(401);
  expect(mocks.verify).not.toHaveBeenCalled();
});
it('rejects cross-origin push registration before reading the body', async () => {
  const response = await subscribe(new Request('http://localhost:3000/api/notifications/subscribe', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' }));
  expect(response.status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
