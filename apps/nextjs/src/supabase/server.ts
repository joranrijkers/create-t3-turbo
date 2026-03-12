import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

/**
 * Returns a Supabase client with service role key for server-side storage operations.
 * Returns null if Supabase is not configured (recipe image upload will be disabled).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}
