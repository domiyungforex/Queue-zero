import "server-only";
import { z } from "zod";

function isPublicSupabaseKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Legacy anon keys are JWTs. Check their role to catch accidental use of a
  // service-role key in this public-key setting; Supabase verifies signatures.
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return z.object({ role: z.literal("anon") }).safeParse(payload).success;
  } catch {
    return false;
  }
}

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().refine(isPublicSupabaseKey, {
    message: "Use a Supabase publishable or legacy anon key, never a secret/service-role key",
  }),
});

export function getSupabaseEnv() {
  return schema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
