/**
 * Client-side (browser) Supabase singleton.
 *
 * Uses NEXT_PUBLIC_ env vars so the keys are baked into the JS bundle
 * at build time and available in the browser.  The anon key is safe to
 * expose — Row Level Security on the tables restricts access.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !key) {
    console.warn("[supabase-browser] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
    return null;
  }

  _client = createClient(url, key);
  return _client;
}
