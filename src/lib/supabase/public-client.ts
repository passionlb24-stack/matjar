import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

// A cookie-less anon Supabase client for PUBLIC, non-user-specific reads that we
// want to cache across requests with `unstable_cache`. The normal server client
// reads auth cookies (so it can't run inside unstable_cache), but public data —
// the exchange rate, catalog config — has no per-user component, so a plain anon
// client is both correct and cacheable. RLS still applies (anon role).
export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
