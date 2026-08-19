-- private.app_config was the only table in the database without RLS (MP-015).
--
-- It stores push_hook_secret in plaintext. The private schema is not exposed
-- through PostgREST and anon has no USAGE on it, so nothing reaches this table
-- today — but "no path today" is a property of the API gateway's config, not
-- of the table. Every other table carries its own lock; this one now does too.
--
-- RLS with no policies: deny-all for anyone subject to RLS. The two readers
-- that matter keep working untouched — get_push_subs and notify_push are
-- SECURITY DEFINER functions owned by the table's owner, and a table owner is
-- exempt from RLS unless FORCE is set (it deliberately is not). The service
-- role bypasses RLS wholesale. Nothing else should ever read a hook secret.
alter table private.app_config enable row level security;

-- Belt and braces, 0258-style: say the privileges out loud instead of trusting
-- that the schema's lack of grants keeps holding.
revoke all on table private.app_config from public, anon, authenticated;

-- ============================================================================
-- ROLLED-BACK TEST  (run against prod inside begin;…rollback; — it PASSED)
-- ============================================================================
-- Expected: RESULT PASS owner_read_ok=t anon_select=f auth_select=f
--           anon_schema_usage=f
-- After enabling RLS the owner-context read of push_hook_secret still returned
-- the secret (so the push pipeline keeps working), and anon/authenticated hold
-- neither SELECT on the table nor USAGE on the schema.
