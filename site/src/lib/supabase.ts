import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton Supabase client for server-side data fetching (build-time).
 * Uses the anon key — read-only via RLS policies.
 *
 * Env vars (set in CI or .env.local):
 *   SUPABASE_URL      — e.g. https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY — public anon key
 */

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_ANON_KEY ?? "";

  if (!url || !key) {
    console.warn(
      "[supabase] SUPABASE_URL / SUPABASE_ANON_KEY not set — falling back to JSON files"
    );
    return null;
  }

  _client = createClient(url, key);
  return _client;
}

export function isSupabaseEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
