-- MP-019. Filed as "five SECURITY DEFINER functions pin search_path to
-- 'public' rather than ''".
--
-- RE-COUNT. Measured against production: of 194 SECURITY DEFINER functions in
-- schema public, exactly FOUR set search_path to anything other than '':
--
--   class_spots_taken(uuid, date)       search_path=public   reads `bookings` UNQUALIFIED
--   resource_booked_times(uuid, date)   search_path=public   reads `bookings` UNQUALIFIED
--   handle_new_user()                   search_path=public   qualifies public.profiles,
--                                                            but casts to the bare enum
--                                                            `platform_role`
--   log_tool_use(text)                  search_path=public   already fully qualified
--
-- Four, not five. Every other definer function is already search_path=''.
--
-- ---------------------------------------------------------------------------
-- EXPLOITABLE vs UNTIDY
-- ---------------------------------------------------------------------------
-- The mechanism is real and was demonstrated, in a rolled-back transaction
-- against production:
--
--   both `anon` and `authenticated` hold TEMP on the database, so either can
--   `create temp table bookings (...)`. pg_temp is searched before the schemas
--   named in search_path for relation lookups unless it is listed explicitly,
--   which `search_path=public` does not do. With one fake row in pg_temp.bookings
--   for a real class id, `class_spots_taken(<that class>, current_date)`
--   returned 1 while `public.bookings` held 0. Same shape for
--   resource_booked_times.
--
-- What that is NOT: a live exploit. Reaching it needs two statements in one
-- database session — CREATE TEMP TABLE, then the RPC. The only route a browser
-- has to these functions is a PostgREST /rpc/ call, which is one statement on a
-- pooled connection; the anon key is a JWT for PostgREST, not database
-- credentials, so there is no session to hold a temp table open in. Both
-- functions are also read-only aggregates over booking times, so the worst a
-- successful substitution buys is a wrong availability grid on the caller's own
-- screen — capacity itself is enforced by enforce_class_capacity() and the slot
-- conflict guard, which are separate functions and already search_path=''.
--
-- So: mechanism PROVEN, exploit path NOT demonstrated. Fixing the convention,
-- not a live hole. handle_new_user() and log_tool_use() are further from the
-- edge again — handle_new_user fires as supabase_auth_admin on auth.users
-- inserts, where no client controls the session, and log_tool_use already
-- names every object it touches.
--
-- ---------------------------------------------------------------------------
-- QUALIFY FIRST, THEN TIGHTEN. Flipping search_path to '' without qualifying
-- the references breaks the function silently at the next call, so each body
-- below spells out public.bookings / public.platform_role / public.profiles /
-- public.hub_tool_events / auth.uid() before the setting changes.
--
-- Signatures and return types are unchanged (create or replace, same argument
-- list, same returns), so no deployed caller sees a different contract:
--   class_spots_taken       src/components/classes-booking.tsx:64, :88
--   resource_booked_times   src/components/timeslot-booking.tsx:104, :129
--   log_tool_use            src/lib/track-tool.ts:15
--   handle_new_user         no src caller; it is the trigger on auth.users
-- create or replace also preserves the ACLs 0284 just set on the first two.

create or replace function public.class_spots_taken(p_class_id uuid, p_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select count(*)::int from public.bookings
  where class_id = p_class_id
    and requested_date = p_date
    and status::text not in ('cancelled', 'rejected', 'declined', 'no_show');
$fn$;

create or replace function public.resource_booked_times(p_resource_id uuid, p_date date)
returns setof text
language sql
stable
security definer
set search_path = ''
as $fn$
  select requested_time from public.bookings
  where resource_id = p_resource_id
    and requested_date = p_date
    and requested_time is not null
    and status::text not in ('cancelled', 'rejected', 'declined', 'no_show');
$fn$;

create or replace function public.log_tool_use(p_tool text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_tool is null or length(p_tool) > 60 then return; end if;
  insert into public.hub_tool_events (tool, user_id) values (p_tool, (select auth.uid()));
end;
$fn$;

-- The signup trigger. `platform_role` was the only unqualified name in it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  requested_type text := new.raw_user_meta_data ->> 'account_type';
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when requested_type = 'merchant' then 'merchant'::public.platform_role
      else 'customer'::public.platform_role
    end
  );
  return new;
end;
$fn$;

-- Audience: class_spots_taken and resource_booked_times were the two MP-019
-- names that had never been revoked; 0284 gave them their explicit
-- revoke/grant line one migration earlier, so nothing further is needed here.
-- log_tool_use and handle_new_user already had theirs.

-- ============================================================================
-- ROLLED-BACK TEST (run against production inside begin;...rollback; -- PASSED)
-- ============================================================================
-- (1) Shadowing, before and after. With a pg_temp.bookings holding one fake row
--     for a real class id and a real resource id:
--       BEFORE  class_spots_taken     -> 1   (public.bookings held 0)
--       BEFORE  resource_booked_times -> 1 row
--       AFTER   class_spots_taken     -> 0   == the real count
--       AFTER   resource_booked_times -> 0   == the real count
-- (2) Same answers on real data, no shadow present. Every (resource, date)
--     pair that has a booking, and every (class, date) pair in the table,
--     compared before and after: 5 comparisons, all IDENTICAL — e.g.
--     resource_booked_times(40cc8819…, 2026-07-28) = "00:00,17:00" both ways,
--     and the full class_spots_taken grid across 11 dates matched string for
--     string, including the one date that returns 1.
-- (3) log_tool_use('probe-tool') as `authenticated` still inserted its row.
-- (4) handle_new_user: a real insert into auth.users with
--     raw_user_meta_data {full_name, account_type: merchant} still produced the
--     matching public.profiles row with role = 'merchant'. Signup is intact.
