import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const focus = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.fn();
  const match = vi.fn();
  const self = {
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    location: { origin: 'https://queuezero.test' },
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue([{ url: 'https://queuezero.test/ticket/00000000-0000-4000-8000-000000000001', focus }]), openWindow },
  };
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches: { match }, fetch, Response, URL });
  return { handlers, fetch, match, showNotification, openWindow, focus };
}
it('preserves online navigation and does not intercept API or mutation requests', async () => {
  const w = worker();
  const response = new Response(null, { status: 302, headers: { Location: '/sign-in' } });
  w.fetch.mockResolvedValue(response);
  const respondWith = vi.fn();
  w.handlers.fetch({ request: { mode: 'navigate', method: 'GET' }, respondWith });
  expect(await respondWith.mock.calls[0][0]).toBe(response);
  respondWith.mockClear();
  w.handlers.fetch({ request: { mode: 'cors', method: 'GET' }, respondWith });
  w.handlers.fetch({ request: { mode: 'navigate', method: 'POST' }, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
});
it('provides a response even if offline cache was evicted', async () => {
  const w = worker();
  w.fetch.mockRejectedValue(new Error('offline'));
  w.match.mockResolvedValue(undefined);
  const respondWith = vi.fn();
  w.handlers.fetch({ request: { mode: 'navigate', method: 'GET' }, respondWith });
  const response = await respondWith.mock.calls[0][0];
  expect(response.status).toBe(503);
  expect(await response.text()).toContain('offline');
});
it('displays a push and focuses the existing private ticket window', async () => {
  const w = worker();
  const url = '/ticket/00000000-0000-4000-8000-000000000001';
  const waitUntil = vi.fn();
  w.handlers.push({ data: { json: () => ({ title: 'It’s your turn', body: 'Return to the service area.', url }) }, waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(w.showNotification).toHaveBeenCalledWith('It’s your turn', expect.objectContaining({ data: { url } }));
  waitUntil.mockClear();
  w.handlers.notificationclick({ notification: { close: vi.fn(), data: { url } }, waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(w.focus).toHaveBeenCalledOnce();
  expect(w.openWindow).not.toHaveBeenCalled();
});
it('ignores malformed pushes and never opens an external notification URL', () => {
  const w = worker();
  const waitUntil = vi.fn();
  w.handlers.push({ data: { json: () => { throw new Error('bad JSON'); } }, waitUntil });
  w.handlers.notificationclick({ notification: { close: vi.fn(), data: { url: 'https://evil.test' } }, waitUntil });
  expect(w.showNotification).not.toHaveBeenCalled();
  expect(waitUntil).not.toHaveBeenCalled();
});
