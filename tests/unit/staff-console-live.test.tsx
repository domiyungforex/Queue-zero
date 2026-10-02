// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { QueueConsole } from '@/lib/validation/operations';
const mocks = vi.hoisted(() => ({ operation: vi.fn(), useLive: vi.fn() }));
vi.mock('@/app/dashboard/queues/[queueId]/actions', () => ({ runQueueOperation: mocks.operation }));
vi.mock('@/lib/realtime/use-live', () => ({ useLive: mocks.useLive }));
import { StaffConsole } from '@/components/queue/staff-console';
const initial: QueueConsole = { queue_id:'ab000000-0000-4000-8000-000000000001', name:'Test queue',slug:'test-queue',status:'open',average_service_seconds:300,warning_threshold:3,waiting:[{id:'ab000000-0000-4000-8000-000000000002',display_number:'A001',customer_name:'Test customer',status:'waiting'}],serving:null,served_today:0,no_shows_today:0 };
beforeEach(() => { sessionStorage.clear(); mocks.useLive.mockReturnValue(true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('waits for the server action and authoritative fetch before changing the queue', async () => {
  let finish!: (value: { ok: boolean; message: string }) => void;
  mocks.operation.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const snapshot = { ...initial, waiting: [], serving: { ...initial.waiting[0], status: 'serving' } };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot)));
  vi.stubGlobal('fetch', fetch);
  render(<StaffConsole initial={initial} manager />);
  fireEvent.click(screen.getByRole('button', { name: 'Call next' }));
  expect(mocks.operation).toHaveBeenCalledWith(expect.objectContaining({ operation:'call_next',queueId:initial.queue_id }));
  expect(screen.queryByRole('button', { name: 'Complete service' })).toBeNull();
  await act(async () => { finish({ ok:true,message:'Customer called.' }); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Complete service' })).toBeTruthy());
  expect(fetch).toHaveBeenCalledWith(`/api/queues/${initial.queue_id}`,expect.objectContaining({ cache:'no-store' }));
});
it('shows a connection failure without inventing a successful call or advancing customers', async () => {
  mocks.operation.mockRejectedValue(new Error('offline'));
  render(<StaffConsole initial={initial} manager />);
  fireEvent.click(screen.getByRole('button', { name: 'Call next' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry last action' })).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Complete service' })).toBeNull();
  expect(screen.getByText('Test customer')).toBeTruthy();
});
