import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/db/env";
import type { Database } from "@/lib/db/database.types";

/** Anonymous server-side reads. Never forwards Clerk identity or uses a service key. */
export function createPublicSupabaseClient() {
  const env = getSupabaseEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { retry: false, timeout: 10_000 },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Public queue status is a fresh snapshot, not a Next.js cached fetch.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
