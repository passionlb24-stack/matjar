-- B-02 residual. The main fix landed already: get_push_subs is revoked from
-- anon and authenticated (0274) and /api/push/hook calls it through the
-- service-role client. What remained is that `p_secret` is still a PARAMETER,
-- so the shared secret is sent as an RPC argument on every push — and RPC
-- arguments end up in pg_stat_activity.query while the call runs, in
-- log_statement / log_min_duration_statement output, and in error DETAIL lines,
-- all of which Supabase ships to the log pipeline.
--
-- ── does p_secret still earn its place? No. ─────────────────────────────────
-- Grants on the function today are exactly `postgres:EXECUTE,
-- service_role:EXECUTE`. Anyone able to reach the function therefore already
-- holds the service role, and the service role can simply
-- `select * from public.push_subscriptions` — RLS does not apply to it. So the
-- secret check cannot refuse anything to the only caller that can invoke it.
-- It is a lock on the inside of a door that is already open to whoever is
-- standing there, and the key is being read aloud on every trip.
--
-- Meanwhile the real authentication is upstream and unaffected: the route
-- compares the x-push-secret header against PUSH_HOOK_SECRET with
-- timingSafeEqual and returns 403 before any database call happens. That check
-- is where an untrusted caller is actually turned away. Removing the in-
-- function copy does not move that boundary.
--
-- What this DOES give up, stated plainly rather than glossed: the function's
-- entire protection is now the EXECUTE grant. If anyone ever re-grants it to
-- anon or authenticated, MJ-A02 is open again with nothing behind it. The
-- revoke below is restated explicitly for that reason, and this is the audience
-- statement 0281 asks every definer function for.
--
-- ── the signature change, which is the dangerous part ───────────────────────
-- 0289 documents the trap: a `create or replace` that ADDS a defaulted
-- parameter does not replace the old function, it creates a second one, and the
-- old call then matches both — ambiguous, on a live path. That is not the shape
-- of this change. Here the parameter LIST is unchanged: (uuid, text) before and
-- (uuid, text) after. Only a DEFAULT is added to the second parameter, which
-- Postgres permits on `create or replace` and which does not alter the
-- signature. Exactly one function exists before and after, so nothing can be
-- ambiguous, and no drop is needed or wanted.
--
-- That is deliberate, because the alternative — dropping to a one-parameter
-- function now — would break the build that is RUNNING. The deployed
-- /api/push/hook sends {p_uid, p_secret}; against a one-parameter function
-- PostgREST answers PGRST202, the route's `data` comes back null, `list` is
-- empty, and it returns {sent: 0}. Every push would stop, silently, with a 200.
-- Zero push subscriptions exist today so the real blast radius is nil, but that
-- is luck, not design, and it is the same silent shape as the revoke that took
-- the reviews block off every store page this morning.
--
-- The defaulted parameter is therefore a compatibility shim with one job:
-- let the currently deployed 2-argument call keep resolving while the
-- 1-argument route rolls out. It is ignored, not validated — it has to be
-- ignored, or the 1-argument call would fail its own check and return nothing.
--
-- Deployed call sites checked before touching this (grep over src/ and
-- supabase/): exactly one, src/app/api/push/hook/route.ts:47. No SQL caller —
-- notify_push() posts to the route over pg_net, it does not call this function.
--
-- Verified in a rolled-back transaction against production before applying:
--   * exactly one overload of get_push_subs remains;
--   * the DEPLOYED 2-named-argument call resolves and returns the row;
--   * the 1-named-argument call the updated route makes resolves and returns
--     the same row and payload;
--   * anon and authenticated are refused (42501) on BOTH forms;
--   * service_role is allowed on both.

create or replace function public.get_push_subs(p_uid uuid, p_secret text default null)
returns table (endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
begin
  -- p_secret is accepted and ignored. See the header: it exists only so the
  -- deployed 2-argument call keeps resolving until the 1-argument route ships.
  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s where s.user_id = p_uid;
end $$;

-- Audience (0281): the database's own push bridge, holding the service role.
-- Never a browser. 0258's lesson is why anon and authenticated are named
-- explicitly rather than relying on revoking from `public`.
revoke all on function public.get_push_subs(uuid, text) from public, anon, authenticated;
grant execute on function public.get_push_subs(uuid, text) to service_role;

comment on function public.get_push_subs(uuid, text) is
  'Service-role only. Returns a user''s Web Push credentials for the push hook. '
  'p_secret is a deprecated no-op kept so the pre-0293 route keeps resolving; '
  'drop it once no deployed build passes it.';

-- ── AFTER THE APP DEPLOY, NOT BEFORE ───────────────────────────────────────
-- Once a build in which /api/push/hook calls get_push_subs with p_uid ONLY is
-- live, the shim has no user left and the parameter should go for good. That is
-- a real signature change, so it follows 0289's pattern — explicit drop, then
-- create, in one transaction — and it belongs in its own migration, applied
-- only after the deploy is confirmed. Do not uncomment this here.
--
--   drop function if exists public.get_push_subs(uuid, text);
--   create or replace function public.get_push_subs(p_uid uuid)
--   returns table (endpoint text, p256dh text, auth text)
--   language plpgsql security definer set search_path = '' as $$
--   begin
--     return query
--       select s.endpoint, s.p256dh, s.auth
--       from public.push_subscriptions s where s.user_id = p_uid;
--   end $$;
--   revoke all on function public.get_push_subs(uuid) from public, anon, authenticated;
--   grant execute on function public.get_push_subs(uuid) to service_role;
