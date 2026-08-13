import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

// Service-role client. Bypasses RLS completely, so it must never be reachable
// from a browser — hence `server-only`, which turns an accidental client import
// into a build error rather than a leaked key.
//
// It exists for one job: signing a URL for a file in the private digital-goods
// bucket. That bucket has no read policy at all, deliberately, because "may this
// person download this" is a question about an ORDER, not about a storage path,
// and RLS on storage.objects cannot see orders. The entitlement is decided first
// by digital_download_grant() running as the actual caller; only then does this
// client mint the link.
//
// Any new use of it should be treated as a security review, not a convenience.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The same client, for callers that would rather answer than crash.
//
// A missing key is a deployment problem, not a request problem, and throwing it
// out of a route handler produces a 500 with an empty body. The browser then
// fails to parse the response and falls into whatever generic catch it has, so
// an employee holding a valid code is told the code is wrong — and the one fact
// that would have explained it never reaches anyone. Clock-in was down in
// production for exactly this reason, and it read as three different bugs.
export function adminClientIfConfigured() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null;
}
