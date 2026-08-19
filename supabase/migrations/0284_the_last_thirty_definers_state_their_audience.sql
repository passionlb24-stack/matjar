-- MP-013, continued from 0281.
--
-- RE-COUNT FIRST. The issue says "55 directly callable SECURITY DEFINER
-- functions have no REVOKE". That number predates 0281, which handled 96 of
-- them. Measured against production today:
--
--   194  SECURITY DEFINER functions in schema public
--    39  still executable by `anon`
--    30  distinct names with no `revoke ... on function` line anywhere in
--        supabase/migrations
--
-- Those two sets overlap but are not the same, and neither is 55.
--
-- WHAT WAS ACTUALLY REACHABLE-AND-UNGUARDED: nothing. Of the 39 anon-callable,
-- 38 are the exact set 0281 classified as (a) "stays anon-callable" -- RLS
-- policy helpers the querying role must evaluate, plus the guest storefront
-- RPCs. The 39th, craft_request_within_limits(uuid, text), is an RLS helper
-- 0279 added days before 0281 and 0281's prose simply did not list; it already
-- carries its own revoke/grant line and is left alone here. So this migration
-- closes zero live holes. It closes a DRIFT hole, which is the real finding:
--
--   Seven of the 30 (join_booking_waitlist, manage_service_request,
--   place_booking, record_order_payment, redeem_loyalty_points,
--   set_loyalty_redemption, notify_new_service_request) are already
--   anon-less in production, but no migration says so. Their privileges came
--   out that way from whatever role created them, not from an instruction. A
--   later `create or replace` run under a different role, or a restore from
--   these migration files into a fresh project, hands them back to anon
--   silently. That is the whole point of the convention 0281 set.
--
-- The other 23 keep anon deliberately; they now say so out loud, and lose the
-- blanket PUBLIC grant they were also carrying (`=X/postgres` in proacl), so a
-- future role inherits nothing by default.
--
-- CALL SITES CHECKED before narrowing anything (grep over src/ on this branch):
--   join_booking_waitlist  src/components/booking-panel.tsx:211   "use client"
--   place_booking          src/components/booking-panel.tsx:484   "use client",
--                          and :462-466 redirects to /login when there is no
--                          user, so no guest path reaches it
--   manage_service_request src/components/service-request-form.tsx:135 and
--                          src/components/service-request-manager.tsx:71
--   record_order_payment   src/components/order-payments.tsx:81
--   redeem_loyalty_points  src/components/crm-manager.tsx:625
--   set_loyalty_redemption src/components/crm-manager.tsx:733
--   notify_new_service_request  no call site -- it is a trigger; firing a
--                          trigger does not consult EXECUTE (0120's precedent)
-- The four service-role routes (api/clock/punch, api/clock/register,
-- api/push/hook, [lang]/download/[itemId]) were checked too: the only definer
-- function any of them calls is get_push_subs, which 0274 already handled and
-- which this migration does not touch. service_role holds a direct grant on
-- all 30 (`service_role=X/postgres`), so revoking from public costs it nothing.
--
-- 0258's lesson still applies: `revoke ... from public` alone leaves anon's and
-- authenticated's own direct grants in place, so both are named explicitly.

-- ---------------------------------------------------------------------------
-- (a) STAYS ANON-CALLABLE -- policy helpers and guest storefront RPCs
-- ---------------------------------------------------------------------------
revoke all on function public.admin_can(text) from public, anon, authenticated;
grant execute on function public.admin_can(text) to anon, authenticated;
revoke all on function public.bought_together(uuid, integer) from public, anon, authenticated;
grant execute on function public.bought_together(uuid, integer) to anon, authenticated;
revoke all on function public.buy_tickets(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.buy_tickets(uuid, integer, text, text) to anon, authenticated;
revoke all on function public.class_spots_taken(uuid, date) from public, anon, authenticated;
grant execute on function public.class_spots_taken(uuid, date) to anon, authenticated;
revoke all on function public.clock_store_context(text) from public, anon, authenticated;
grant execute on function public.clock_store_context(text) to anon, authenticated;
revoke all on function public.create_lead(uuid, uuid, public.lead_kind, text, text, text) from public, anon, authenticated;
grant execute on function public.create_lead(uuid, uuid, public.lead_kind, text, text, text) to anon, authenticated;
revoke all on function public.enroll_course(uuid, text, text) from public, anon, authenticated;
grant execute on function public.enroll_course(uuid, text, text) to anon, authenticated;
revoke all on function public.get_best_sellers(integer) from public, anon, authenticated;
grant execute on function public.get_best_sellers(integer) to anon, authenticated;
revoke all on function public.increment_listing_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;
revoke all on function public.is_conversation_participant(uuid) from public, anon, authenticated;
grant execute on function public.is_conversation_participant(uuid) to anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to anon, authenticated;
revoke all on function public.is_super_admin() from public, anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
revoke all on function public.owns_craft_provider(uuid) from public, anon, authenticated;
grant execute on function public.owns_craft_provider(uuid) to anon, authenticated;
revoke all on function public.owns_store() from public, anon, authenticated;
grant execute on function public.owns_store() to anon, authenticated;
revoke all on function public.place_stay_booking(uuid, date, date, integer, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.place_stay_booking(uuid, date, date, integer, integer, text, text, text) to anon, authenticated;
revoke all on function public.product_sold_count(uuid) from public, anon, authenticated;
grant execute on function public.product_sold_count(uuid) to anon, authenticated;
revoke all on function public.public_lister_profile(uuid) from public, anon, authenticated;
grant execute on function public.public_lister_profile(uuid) to anon, authenticated;
revoke all on function public.resource_booked_times(uuid, date) from public, anon, authenticated;
grant execute on function public.resource_booked_times(uuid, date) to anon, authenticated;
revoke all on function public.search_stay(uuid, date, date, integer) from public, anon, authenticated;
grant execute on function public.search_stay(uuid, date, date, integer) to anon, authenticated;
revoke all on function public.store_fulfilled_count(uuid) from public, anon, authenticated;
grant execute on function public.store_fulfilled_count(uuid) to anon, authenticated;
revoke all on function public.subscribe_membership(uuid, text, text) from public, anon, authenticated;
grant execute on function public.subscribe_membership(uuid, text, text) to anon, authenticated;
revoke all on function public.track_store_visit(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.track_store_visit(uuid, uuid, text, text, text, text, text) to anon, authenticated;
revoke all on function public.user_is_active() from public, anon, authenticated;
grant execute on function public.user_is_active() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b) AUTHENTICATED-ONLY -- every call site runs under a session
-- ---------------------------------------------------------------------------
revoke all on function public.join_booking_waitlist(uuid, uuid, date, uuid, text, text) from public, anon, authenticated;
grant execute on function public.join_booking_waitlist(uuid, uuid, date, uuid, text, text) to authenticated;
revoke all on function public.manage_service_request(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.manage_service_request(uuid, text, numeric, text) to authenticated;
revoke all on function public.place_booking(uuid, uuid, date, text, uuid, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.place_booking(uuid, uuid, date, text, uuid, boolean, text, text, text, text) to authenticated;
revoke all on function public.record_order_payment(uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.record_order_payment(uuid, text, numeric, text, text) to authenticated;
revoke all on function public.redeem_loyalty_points(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.redeem_loyalty_points(uuid, uuid, integer, text) to authenticated;
revoke all on function public.set_loyalty_redemption(uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.set_loyalty_redemption(uuid, boolean, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- (c) NO CLIENT ROLE AT ALL -- trigger function
-- ---------------------------------------------------------------------------
revoke all on function public.notify_new_service_request() from public, anon, authenticated;

-- ============================================================================
-- ROLLED-BACK TEST (run against production inside begin;...rollback; -- PASSED)
-- ============================================================================
-- 120 privilege assertions, 120 PASS, 0 FAIL. A throwaway `probe_role` with no
-- grants stood in for "some future role that used to inherit from PUBLIC".
--   23 (a) functions x {anon true, authenticated true, service_role true,
--                       probe_role false}
--    6 (b) functions x {anon false, authenticated true, service_role true,
--                       probe_role false}
--    1 (c) function  x {anon false, authenticated false, service_role true,
--                       probe_role false}
