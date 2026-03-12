import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SUPABASE_URL
    ? process.env.EXPO_PUBLIC_SUPABASE_URL
    : "";
const supabaseAnonKey =
  typeof process !== "undefined" && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : "";

/**
 * Supabase client for Realtime subscriptions in the Expo app.
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the .env
 * that Expo loads (e.g. project root or apps/expo/.env); restart the dev server
 * after changing env. Enable Realtime for tables shopping_list and shopping_item
 * in Supabase Dashboard.
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}
