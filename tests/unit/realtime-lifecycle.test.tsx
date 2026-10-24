// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ setAuth: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
let authFailed: () => void;
vi.mock("@/lib/realtime/client", () => ({ acquireRealtimeClient: (_authenticated: boolean, onError: () => void) => {
  authFailed = onError;
  return { client: { channel: mocks.channel, removeChannel: mocks.removeChannel }, authorize: mocks.setAuth, release: vi.fn() };
} }));
import { useLive } from "@/lib/realtime/use-live";
let subscribed: (status: string) => void;
let changed: () => void;
const channel = { on: vi.fn(), subscribe: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture");
  mocks.setAuth.mockReset().mockResolvedValue(undefined);
  mocks.channel.mockReset().mockReturnValue(channel);
  mocks.removeChannel.mockReset().mockResolvedValue(undefined);
  channel.on.mockImplementation((_kind, _filter, handler) => { changed = handler; return channel; });
  channel.subscribe.mockImplementation(handler => { subscribed = handler; return channel; });
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
  it("refetches on connection and events without polling a healthy subscription", async () => {
    const refresh = vi.fn();
    const { result, unmount } = renderHook(() => useLive("ticket:fixture", refresh));
    await act(async () => { subscribed("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(200); });
    expect(result.current).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { changed(); changed(); await vi.advanceTimersByTimeAsync(200); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("uses bounded fallback while disconnected and stops it after reconnect", async () => {
    const refresh = vi.fn();
    renderHook(() => useLive("ticket:fallback", refresh));
    await act(async () => { subscribed("CHANNEL_ERROR"); await vi.advanceTimersByTimeAsync(15_200); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { subscribed("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(200); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("pauses refreshes in hidden tabs and resyncs when visible", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const refresh = vi.fn();
    renderHook(() => useLive("ticket:hidden", refresh));
    await act(async () => { changed(); await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(200); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("does not postpone refresh indefinitely during a continuous event stream", async () => {
    const refresh = vi.fn();
    renderHook(() => useLive("ticket:busy", refresh));
    await act(async () => {
      for (let i = 0; i < 10; i++) { changed(); await vi.advanceTimersByTimeAsync(100); }
    });
    expect(refresh).toHaveBeenCalled();
    expect(refresh.mock.calls.length).toBeLessThan(10);
  });
  it("removes the channel and stops refreshes when disabled", async () => {
    const refresh = vi.fn();
    const { result, rerender } = renderHook(({enabled}) => useLive("ticket:done", refresh, false, enabled), {initialProps:{enabled:true}});
    await act(async () => { subscribed("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(200); });
    rerender({enabled:false});
    expect(result.current).toBe(false);
    await act(async () => { changed(); await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
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
  it("replaces an expired staff subscription after token renewal recovers", async () => {
    renderHook(() => useLive("queue:renewal", vi.fn(), true));
    await act(async () => {});
    await act(async () => { subscribed("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(200); });
    await act(async () => { authFailed(); });
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_200); });
    expect(mocks.channel).toHaveBeenCalledTimes(2);
  });
  it("does not subscribe if the session changes while authorization is pending", async () => {
    let complete!: () => void;
    mocks.setAuth.mockReturnValueOnce(new Promise<void>(r => { complete = r; }));
    renderHook(() => useLive("queue:account-change", vi.fn(), true));
    await act(async () => { authFailed(); complete(); });
    expect(mocks.channel).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_200); });
    expect(mocks.channel).toHaveBeenCalledOnce();
  });
  it("ignores a late CLOSED callback from a removed channel after recovery", async () => {
    const { result } = renderHook(() => useLive("queue:late-close", vi.fn(), true));
    await act(async () => {});
    const stale = subscribed;
    await act(async () => { authFailed(); await vi.advanceTimersByTimeAsync(15_200); });
    await act(async () => { subscribed("SUBSCRIBED"); });
    expect(result.current).toBe(true);
    await act(async () => { stale("CLOSED"); });
    expect(result.current).toBe(true);
    expect(mocks.removeChannel).toHaveBeenCalledOnce();
  });
});
