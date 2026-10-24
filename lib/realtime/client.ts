"use client";

import { createClient } from "@supabase/supabase-js";

type Client = Pick<ReturnType<typeof createClient>, "channel" | "removeChannel" | "realtime">;
type Entry = {
  client: Client;
  listeners: Set<() => void>;
  users: number;
  token: ReturnType<typeof createTokenSource> | null;
};
let publicEntry: Entry | undefined;
let authenticatedEntry: Entry | undefined;
let session: string | null | undefined;

// This payload is timing metadata only. Clerk issues the token; Supabase still
// verifies its signature, expiry and claims before authorizing any subscription.
function expiresAt(token: string) {
  const payload: unknown = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (!payload || typeof payload !== "object" || !("exp" in payload) || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("Live session unavailable");
  }
  return payload.exp * 1_000;
}

function createTokenSource(onFailure: () => void) {
  let cached: { token: string; expires: number } | null = null;
  let pending: Promise<string> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  let disposed = false;
  const clear = () => {
    generation++;
    cached = null;
    pending = null;
    controller?.abort();
    controller = null;
  };
  return {
    clear,
    revision: () => generation,
    dispose() { disposed = true; clear(); },
    get(): Promise<string> {
      if (disposed) return Promise.reject(new Error("Live session unavailable"));
      // The SDK calls this on every heartbeat (25s). Keep a 30s safety window,
      // and share both cached tokens and in-flight requests across every widget.
      if (cached && cached.expires - Date.now() > 30_000) return Promise.resolve(cached.token);
      if (pending) return pending;
      const current = generation;
      controller = new AbortController();
      pending = (async () => {
        try {
          const response = await fetch("/api/realtime", {
            cache: "no-store",
            signal: AbortSignal.any([controller!.signal, AbortSignal.timeout(10_000)]),
          });
          if (!response.ok) throw new Error();
          const data: unknown = await response.json();
          if (!data || typeof data !== "object" || !("token" in data) || typeof data.token !== "string") throw new Error();
          const expires = expiresAt(data.token);
          if (disposed || generation !== current || expires <= Date.now()) throw new Error();
          cached = { token: data.token, expires };
          return data.token;
        } catch {
          if (!disposed && generation === current) {
            cached = null;
            // The SDK swallows callback errors and reuses its old token. Notify
            // consumers explicitly so stale subscriptions are removed instead.
            onFailure();
          }
          throw new Error("Live session unavailable");
        } finally {
          if (generation === current) { pending = null; controller = null; }
        }
      })();
      return pending;
    },
  };
}

/** A browser-session lease. No token is persisted to storage or shared server-side. */
export function acquireRealtimeClient(authenticated: boolean, onAuthError: () => void = () => {}) {
  let entry = authenticated ? authenticatedEntry : publicEntry;
  if (!entry) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const listeners = new Set<() => void>();
    const token = authenticated ? createTokenSource(() => { for (const listener of listeners) listener(); }) : null;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
        storageKey: authenticated ? "turnmark-realtime-staff" : "turnmark-realtime-public" },
      accessToken: token ? () => token.get() : undefined,
    });
    entry = { client, listeners, users: 0, token };
    if (authenticated) authenticatedEntry = entry;
    else publicEntry = entry;
  }
  const owned = entry;
  owned.users++;
  owned.listeners.add(onAuthError);
  let released = false;
  return {
    client: owned.client,
    async authorize() {
      if (released) throw new Error("Live session unavailable");
      if (owned.token) {
        // Do not rely on setAuth() rejecting: the SDK catches callback failures.
        const revision = owned.token.revision();
        const token = await owned.token.get();
        if (released || revision !== owned.token.revision()) throw new Error("Live session unavailable");
        await owned.client.realtime.setAuth(token);
        if (released || revision !== owned.token.revision()) throw new Error("Live session unavailable");
      }
    },
    release() {
      if (released) return;
      released = true;
      owned.listeners.delete(onAuthError);
      if (--owned.users === 0) {
        owned.token?.dispose();
        owned.client.realtime.disconnect();
        if (authenticatedEntry === owned) authenticatedEntry = undefined;
        if (publicEntry === owned) publicEntry = undefined;
      }
    },
  };
}

export function resetAuthenticatedRealtime() {
  const entry = authenticatedEntry;
  if (!entry) return;
  entry.token?.clear();
  entry.client.realtime.disconnect();
  for (const listener of entry.listeners) listener();
}

/** Called by the existing Clerk account UI, including cross-tab session changes. */
export function syncRealtimeSession(sessionId: string | null) {
  if (session === sessionId) return;
  const initial = session === undefined;
  session = sessionId;
  // Initial hydration already fetches with the current Clerk cookie. Do not
  // abort that request just because the first account observer has loaded.
  if (!initial || sessionId === null) resetAuthenticatedRealtime();
}
