import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseEnv } from "@/lib/db/env";
import type { Database } from "@/lib/db/database.types";

function isServiceKey(key: string): boolean {
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return z.object({ role: z.literal("service_role") }).safeParse(payload).success;
  } catch { return false; }
}

/** Restricted to controlled public join/cancel actions; never forward this client to a component. */
export function createJoinSupabaseClient() {
  const env = getSupabaseEnv();
  const parsed = z.string().refine(isServiceKey).safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!parsed.success) throw new Error("Configure a Supabase secret or legacy service-role key for customer joining.");
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, parsed.data, {
    db: { retry: false, timeout: 10_000 },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
