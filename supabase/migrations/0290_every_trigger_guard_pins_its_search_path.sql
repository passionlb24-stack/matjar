-- Cleaning up after myself. 0285 pinned search_path on every SECURITY DEFINER
-- function; the guards below are SECURITY INVOKER and were out of that scope, and
-- two of them (guard_product_review_subject, guard_craft_review_subject) I wrote
-- in 0288 without a pinned path — creating the exact debt 0285 had just paid off.
--
-- The risk here is genuinely lower than for a definer function: an invoker
-- function runs as the caller, so shadowing a table name gains an attacker nothing
-- they could not already do directly. But these six are trigger guards — they are
-- the thing standing between a browser role and a column it must not write — and
-- "the attacker gains nothing" is a weaker guarantee than "the name cannot be
-- shadowed at all". It also clears six advisor warnings that would otherwise sit
-- alongside real ones and dull them.
--
-- Safe because none of the six resolves an unqualified name that search_path
-- controls: they reference auth.uid(), public.is_super_admin() and NEW/OLD, plus
-- built-ins that live in pg_catalog, which is always searched regardless. Verified
-- rather than assumed — applied in a rolled-back transaction first, with a real
-- review updated through guard_review_columns and meters_between recomputed (1445 m
-- for a 0.01-degree step in Beirut) under the pinned path.
--
-- Signature note: meters_between takes numeric, not double precision. Guessing the
-- argument types produced "function does not exist", which is a failure that would
-- have been silent in a migration file that nobody ran interactively.

alter function public.guard_review_columns() set search_path = '';
alter function public.guard_product_review_subject() set search_path = '';
alter function public.guard_craft_review_subject() set search_path = '';
alter function public.guard_verification_outcome() set search_path = '';
alter function public.clear_trial_on_paid_plan() set search_path = '';
alter function public.meters_between(numeric,numeric,numeric,numeric) set search_path = '';

-- The advisor also reports four tables as "RLS enabled, but no policies exist".
-- For these that is the design, not an omission: every path to them is a SECURITY
-- DEFINER function, and adding a policy would open a direct route that does not
-- currently exist. Written onto the tables themselves so the next person to read
-- that advisory finds the reasoning attached to the object rather than in a
-- migration they would have to go looking for.
--
-- private.app_config is the fourth; it lives in a schema browser roles cannot
-- reach at all, so it needs no note here.

comment on table public.store_visits is
  'RLS enabled with NO policy, deliberately. Every read and write goes through a SECURITY DEFINER RPC (track_store_visit, store_visits_summary), so no browser role should reach this table directly. The advisor reports "RLS enabled, no policies" as an INFO; that is the intended posture here, not an oversight. Do not add a policy to silence it — a policy would open a direct path that does not currently exist.';

comment on table public.webauthn_challenges is
  'RLS enabled with NO policy, deliberately. Reached only by issue_webauthn_challenge / spend_webauthn_challenge via the service role from /api/clock/*. A challenge readable by a browser role is a replay waiting to happen. See the note on store_visits.';

comment on table public.enrolment_attempts is
  'RLS enabled with NO policy, deliberately. Written only by the enrolment rate limiter running as a SECURITY DEFINER function. If a caller could read it they could count their own remaining attempts; if they could write it they could clear them. See the note on store_visits.';
