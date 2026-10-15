// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), setAuth: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { useLive } from "@/lib/realtime/use-live";
let subscribed: (status: string) => void;
let changed: () => void;
const channel = { on: vi.fn(), subscribe: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture");
  mocks.setAuth.mockReset().mockResolvedValue(undefined);
  mocks.channel.mockReset().mockReturnValue(channel);
  mocks.removeChannel.mockReset().mockResolvedValue(undefined);
  channel.on.mockImplementation((_kind, _filter, handler) => { changed = handler; return channel; });
  channel.subscribe.mockImplementation(handler => { subscribed = handler; return channel; });
  mocks.createClient.mockReturnValue({ realtime: { setAuth: mocks.setAuth }, channel: mocks.channel, removeChannel: mocks.removeChannel });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("authoritative realtime lifecycle", () => {
  it("waits for staff identity before subscribing and cancels an unmounted connection", async () => {
    let resolve!: () => void;
    mocks.setAuth.mockReturnValue(new Promise<void>(r => { resolve = r; }));
    const { unmount } = renderHook(() => useLive("queue:fixture", vi.fn(), true));
    expect(mocks.channel).not.toHaveBeenCalled();
    unmount();
    await act(async () => { resolve(); });
    expect(mocks.channel).not.toHaveBeenCalled();
  });
  it("refetches on connection, events and fallback polling, and cleans up", async () => {
    const refresh = vi.fn();
    const { result, unmount } = renderHook(() => useLive("ticket:fixture", refresh));
    await act(async () => { subscribed("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(200); });
    expect(result.current).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { changed(); changed(); await vi.advanceTimersByTimeAsync(200); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it("recovers from an initial token failure while continuing HTTP polling", async () => {
    mocks.setAuth.mockRejectedValueOnce(new Error("temporary"));
    const refresh = vi.fn();
    renderHook(() => useLive("queue:fixture", refresh, true));
    await act(async () => {});
    expect(mocks.channel).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_200); });
    expect(refresh).toHaveBeenCalled();
    expect(mocks.channel).toHaveBeenCalledOnce();
  });
  it("reuses one Supabase client for multiple subscriptions with the same access mode", () => {
    const before = mocks.createClient.mock.calls.length;
    const first = renderHook(() => useLive("ticket:first", vi.fn()));
    const second = renderHook(() => useLive("ticket:second", vi.fn()));
    expect(mocks.createClient.mock.calls.length - before).toBeLessThanOrEqual(1);
    first.unmount();
    second.unmount();
  });
});
