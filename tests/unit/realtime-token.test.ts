import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
import { GET } from '@/app/api/realtime/route';
it('returns a non-cacheable verified token', async () => {
  mocks.auth.mockResolvedValue({ userId: 'user_fixture', getToken: async () => 'signed-token' });
  const response = await GET();
  expect(await response.json()).toEqual({ token: 'signed-token' });
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it.each(['missing', 'expired', 'null'])('fails closed for %s sessions without exposing provider errors', async kind => {
  const log = vi.spyOn(console, 'error');
  mocks.auth.mockResolvedValue({ userId: kind === 'missing' ? null : 'user_fixture', getToken: async () => {
    if (kind === 'expired') throw new Error('Secret provider session details');
    return null;
  } });
  const response = await GET();
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ error: 'Sign in required' });
  expect(log).not.toHaveBeenCalled();
});
