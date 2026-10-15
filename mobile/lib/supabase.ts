import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const configuredKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!configuredUrl || !configuredKey) {
  throw new Error("TuRnMaRk mobile Supabase environment is missing.");
}

const url: string = configuredUrl;
const key: string = configuredKey;

export function createMobileSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(url, key, {
    accessToken: async () => (await getToken()) ?? null,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
