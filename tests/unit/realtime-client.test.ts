// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), setAuth: vi.fn(), disconnect: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { acquireRealtimeClient, syncRealtimeSession } from "@/lib/realtime/client";

let callback: () => Promise<string>;
const leases: NonNullable<ReturnType<typeof acquireRealtimeClient>>[] = [];
function acquire(onFailure = vi.fn(), authenticated = true) {
  const lease = acquireRealtimeClient(authenticated, onFailure)!;
  leases.push(lease);
  return lease;
}
function jwt(seconds = 60, subject = "fixture") {
  return `header.${btoa(JSON.stringify({ sub: subject, exp: Date.now() / 1_000 + seconds })).replace(/=/g, "")}.signature`;
}
function respond(token = jwt()) {
  return { ok: true, json: async () => ({ token }) };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-fixture");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => respond()));
  mocks.setAuth.mockReset().mockResolvedValue(undefined);
  mocks.disconnect.mockReset();
  mocks.createClient.mockReset().mockImplementation((_url, _key, options) => {
    callback = options.accessToken;
    return { realtime: { setAuth: mocks.setAuth, disconnect: mocks.disconnect } };
  });
});
afterEach(() => { leases.splice(0).forEach(lease => lease.release()); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("shared realtime authentication", () => {
  it("shares one client and one HTTP request across SDK bootstrap, widgets and heartbeats", async () => {
    const first = acquire();
    const second = acquire();
    const third = acquire();
    await Promise.all([callback(), first.authorize(), second.authorize(), third.authorize()]);
    expect(first.client).toBe(second.client);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(25_000);
    await Promise.all([callback(), second.authorize()]);
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(25_000);
    await Promise.all([callback(), first.authorize(), second.authorize()]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mocks.setAuth).toHaveBeenLastCalledWith(expect.any(String));
  });

  it("uses actual expiry for longer-lived tokens without adding a periodic timer", async () => {
    vi.mocked(fetch).mockResolvedValue(respond(jwt(300)) as Response);
    acquire();
    for (let i = 0; i < 10; i++) { await callback(); await vi.advanceTimersByTimeAsync(25_000); }
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(25_000);
    await callback();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([401, 503])("clears cached identity and notifies every consumer on HTTP %s, even if SDK swallows errors", async (status) => {
    const firstFailure = vi.fn();
    const secondFailure = vi.fn();
    const first = acquire(firstFailure);
    acquire(secondFailure);
    await first.authorize();
    await vi.advanceTimersByTimeAsync(50_000);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status } as Response);
    // The installed SDK catches this callback rejection and reuses its old token.
    await callback().catch(() => "SDK stale fallback");
    expect(firstFailure).toHaveBeenCalledOnce();
    expect(secondFailure).toHaveBeenCalledOnce();
    await first.authorize();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each(["malformed", "expired", "missing-exp"])("rejects %s tokens before subscribing without exposing payloads", async kind => {
    const token = kind === "expired" ? jwt(-1) : kind === "missing-exp" ? `a.${btoa("{}")}.b` : "private-invalid-value";
    vi.mocked(fetch).mockResolvedValue(respond(token) as Response);
    const failure = vi.fn();
    const lease = acquire(failure);
    await expect(lease.authorize()).rejects.toThrow("Live session unavailable");
    expect(failure).toHaveBeenCalledOnce();
    expect(mocks.setAuth).not.toHaveBeenCalled();
  });

  it("keeps a shared connection until the last consumer leaves, then clears the token", async () => {
    const first = acquire();
    const second = acquire();
    await first.authorize();
    first.release();
    first.release();
    expect(mocks.disconnect).not.toHaveBeenCalled();
    await second.authorize();
    expect(fetch).toHaveBeenCalledOnce();
    second.release();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    await acquire().authorize();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts final-release requests and rejects late results instead of caching or applying them", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const lease = acquire();
    const pending = lease.authorize();
    const rejected = expect(pending).rejects.toThrow("Live session unavailable");
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    lease.release();
    expect(signal?.aborted).toBe(true);
    resolve(respond(jwt()) as Response);
    await rejected;
    expect(mocks.setAuth).not.toHaveBeenCalled();
    await acquire().authorize();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("invalidates identity on account changes and sign-out but not duplicate Clerk observers", async () => {
    syncRealtimeSession("session-first");
    const failed = vi.fn();
    const lease = acquire(failed);
    await lease.authorize();
    syncRealtimeSession("session-first");
    await lease.authorize();
    expect(fetch).toHaveBeenCalledOnce();
    syncRealtimeSession("session-second");
    await lease.authorize();
    expect(fetch).toHaveBeenCalledTimes(2);
    syncRealtimeSession(null);
    expect(failed).toHaveBeenCalledTimes(2);
    expect(mocks.disconnect).toHaveBeenCalledTimes(2);
  });

  it("does not apply a cached token after a session reset interrupts authorization", async () => {
    syncRealtimeSession("session-cached");
    const lease = acquire();
    await lease.authorize();
    mocks.setAuth.mockClear();
    const pending = lease.authorize();
    syncRealtimeSession("session-replacement");
    await expect(pending).rejects.toThrow("Live session unavailable");
    expect(mocks.setAuth).not.toHaveBeenCalled();
    await lease.authorize();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects authorization completed after a session changed during SDK setAuth", async () => {
    let complete!: () => void;
    mocks.setAuth.mockReturnValueOnce(new Promise<void>(r => { complete = r; }));
    syncRealtimeSession("session-sdk");
    const lease = acquire();
    const pending = lease.authorize();
    await vi.waitFor(() => expect(mocks.setAuth).toHaveBeenCalled());
    syncRealtimeSession("session-sdk-replaced");
    complete();
    await expect(pending).rejects.toThrow("Live session unavailable");
  });

  it("does not fetch staff credentials for anonymous ticket subscriptions", async () => {
    const lease = acquire(vi.fn(), false);
    await lease.authorize();
    expect(callback).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
