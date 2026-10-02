import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readLimitedBody, RequestBodyTooLarge } from '@/lib/security/request-body';

it('preserves the exact signed text within the limit', async () => {
  const body = '{ "event": "charge.success", "name": "Adé" }\n';
  expect(await readLimitedBody(new Request('https://queuezero.test', { method: 'POST', body }), 100)).toBe(body);
});
it('measures bytes rather than characters', async () => {
  await expect(readLimitedBody(new Request('https://queuezero.test', { method: 'POST', body: 'ééé' }), 5)).rejects.toBeInstanceOf(RequestBodyTooLarge);
});
it('rejects a declared oversized body before reading it', async () => {
  const request = new Request('https://queuezero.test', { method: 'POST', headers: { 'Content-Length': '100' }, body: 'small' });
  await expect(readLimitedBody(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLarge);
  expect(request.bodyUsed).toBe(false);
});
it('cancels oversized chunked input even without a length header', async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel });
  // Node requires duplex for a streaming request; production callers use native Request.
  const request = new Request('https://queuezero.test', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
  await expect(readLimitedBody(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLarge);
  expect(cancel).toHaveBeenCalledOnce();
});
it('accepts an empty request body', async () => {
  expect(await readLimitedBody(new Request('https://queuezero.test'), 10)).toBe('');
});
