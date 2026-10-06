import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("TuRnMaRk mobile Supabase environment is missing.");

export function createMobileSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(url, key, {
    accessToken: async () => (await getToken()) ?? null,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}