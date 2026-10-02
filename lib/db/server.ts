import "server-only";
import { databaseTokenOptions } from "@/lib/auth/database-token";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getSupabaseEnv } from "@/lib/db/env";
import type { Database } from "@/lib/db/database.types";

/** Request-scoped client: the verified Clerk session is subject to database RLS. */
export const createUserSupabaseClient = cache(async () => {
  const { getToken } = await auth.protect();
  const env = getSupabaseEnv();

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Fail promptly on expired sessions. Future writes must choose explicit
      // idempotency/retry semantics rather than relying on implicit SDK retries.
      db: { retry: false, timeout: 10_000 },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      accessToken: async () => {
        // Both paths use Clerk issuer signatures, never a shared Supabase signing secret.
        const options = databaseTokenOptions();
        const token = options ? await getToken(options) : await getToken();
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        return token;
      },
    },
  );
});
