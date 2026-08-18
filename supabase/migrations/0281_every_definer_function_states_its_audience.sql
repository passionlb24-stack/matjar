-- 96 SECURITY DEFINER functions were anon-callable; most never meant to be
-- (MP-013).
--
-- Enumerated from production: pg_proc where prosecdef and
-- has_function_privilege('anon', oid, 'execute'). Supabase grants EXECUTE to
-- anon/authenticated by default, and (0258's lesson) revoking from `public`
-- alone removes none of it. Each function below now states its audience.
-- Classification, cross-checked against every `.rpc("...")` call site in src/
-- on this branch AND origin/main, plus pg_policy / pg_get_functiondef /
-- pg_get_viewdef references in production:
--
-- (a) STAYS ANON-CALLABLE — the deployed storefront calls it without a
--     session, or an RLS policy evaluates it as the querying role:
--     policy helpers: admin_can, is_conversation_participant,
--       is_platform_admin, is_super_admin, owns_craft_provider, owns_store,
--       user_is_active
--     guest storefront RPCs: booked_times, bought_together, browse_crafts,
--       browse_gigs, buy_tickets, class_spots_taken, clock_store_context
--       (clock page uses createPublicClient), create_lead,
--       digital_download_grant, enroll_course, get_best_sellers,
--       get_booking_busy, get_delivery_tracking, get_guest_order,
--       get_guest_order_events, gig_facets, increment_listing_view,
--       log_search, place_guest_order, place_stay_booking,
--       product_sold_count, public_lister_profile, record_checkout_intent,
--       resource_booked_times, search_products_fuzzy, search_stay,
--       search_trades, store_fulfilled_count (public store page),
--       subscribe_membership, track_store_visit, trade_provider_counts
--
-- (b) AUTHENTICATED-ONLY — every call site runs under a session (account,
--     messaging, merchant dashboard, admin), each carries an internal guard:
--     revoked from anon below. store_effective_plan / store_has_plan /
--     store_product_limit keep `authenticated` although no client calls them,
--     because non-definer triggers fired by merchant DML would execute them as
--     the merchant's role.
--
-- (c) NO CLIENT ROLE AT ALL — trigger functions (fired by the system; firing
--     does not consult EXECUTE, 0120 set the precedent) and helpers called
--     only from other definer functions or cron, which run as the owner:
--     revoked from public, anon AND authenticated below. service_role keeps
--     its own direct grant (asserted in the rolled-back test).
--
-- Deliberately NOT revoked despite no src call site (conservative — breaking
-- checkout is worse than a week more exposure): none. The six uncalled RPCs
-- (admin_search_gaps, customer_balance, record_customer_transaction,
-- store_customer_balances, search_store_ids_by_product, void_invoice) went to
-- (b) rather than (c) precisely because "no caller in this repo" is weaker
-- evidence than "called by X as owner": if an unmerged branch uses them, a
-- signed-in user still can.

-- ---------------------------------------------------------------------------
-- (c) trigger functions
-- ---------------------------------------------------------------------------
revoke all on function public.award_loyalty_on_complete() from public, anon, authenticated;
revoke all on function public.enforce_class_capacity() from public, anon, authenticated;
revoke all on function public.fill_craft_review_name() from public, anon, authenticated;
revoke all on function public.guard_guest_order_rate() from public, anon, authenticated;
revoke all on function public.guard_store_featured() from public, anon, authenticated;
revoke all on function public.limit_leader_submissions() from public, anon, authenticated;
revoke all on function public.log_fx_rate_change() from public, anon, authenticated;
revoke all on function public.log_order_status() from public, anon, authenticated;
revoke all on function public.notify_booking_waitlist() from public, anon, authenticated;
revoke all on function public.notify_job_application() from public, anon, authenticated;
revoke all on function public.notify_leader_submission() from public, anon, authenticated;
revoke all on function public.notify_restock() from public, anon, authenticated;
revoke all on function public.on_new_message() from public, anon, authenticated;
revoke all on function public.prevent_admin_perm_change() from public, anon, authenticated;
revoke all on function public.promote_store_owner() from public, anon, authenticated;
revoke all on function public.refund_loyalty_on_cancel() from public, anon, authenticated;
revoke all on function public.resync_parking_on_plan_change() from public, anon, authenticated;
revoke all on function public.retake_stock_on_reactivate() from public, anon, authenticated;
revoke all on function public.stamp_cost_at_sale() from public, anon, authenticated;
revoke all on function public.stamp_fx_rate() from public, anon, authenticated;
revoke all on function public.sync_coupon_use_on_status() from public, anon, authenticated;
revoke all on function public.sync_craft_completed() from public, anon, authenticated;
revoke all on function public.sync_craft_rating() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (c) internal-only helpers: issue_credit_note is called by
-- record_order_payment (definer, owner context); sync_plan_parking by the
-- resync trigger and run_trial_maintenance (cron).
-- ---------------------------------------------------------------------------
revoke all on function public.issue_credit_note(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.sync_plan_parking(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b) authenticated-only
-- ---------------------------------------------------------------------------
revoke all on function public.admin_attention_queue() from public, anon, authenticated;
grant execute on function public.admin_attention_queue() to authenticated;
revoke all on function public.admin_search_gaps(integer) from public, anon, authenticated;
grant execute on function public.admin_search_gaps(integer) to authenticated;
revoke all on function public.conversation_peer(uuid) from public, anon, authenticated;
grant execute on function public.conversation_peer(uuid) to authenticated;
revoke all on function public.customer_balance(uuid) from public, anon, authenticated;
grant execute on function public.customer_balance(uuid) to authenticated;
revoke all on function public.get_my_referral_code() from public, anon, authenticated;
grant execute on function public.get_my_referral_code() to authenticated;
revoke all on function public.import_products(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.import_products(uuid, jsonb, text) to authenticated;
revoke all on function public.issue_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid) to authenticated;
revoke all on function public.loyalty_balance(uuid) from public, anon, authenticated;
grant execute on function public.loyalty_balance(uuid) to authenticated;
revoke all on function public.my_conversations() from public, anon, authenticated;
grant execute on function public.my_conversations() to authenticated;
revoke all on function public.record_customer_transaction(uuid, text, numeric, text, uuid, date) from public, anon, authenticated;
grant execute on function public.record_customer_transaction(uuid, text, numeric, text, uuid, date) to authenticated;
revoke all on function public.record_referral(text) from public, anon, authenticated;
grant execute on function public.record_referral(text) to authenticated;
revoke all on function public.request_delivery(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.request_delivery(uuid, uuid, numeric, text) to authenticated;
revoke all on function public.search_store_ids_by_product(text) from public, anon, authenticated;
grant execute on function public.search_store_ids_by_product(text) to authenticated;
revoke all on function public.set_freelancer_verified(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_freelancer_verified(uuid, boolean) to authenticated;
revoke all on function public.start_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_conversation(uuid, uuid) to authenticated;
revoke all on function public.start_pro_trial(uuid) from public, anon, authenticated;
grant execute on function public.start_pro_trial(uuid) to authenticated;
revoke all on function public.start_store_conversation(uuid) from public, anon, authenticated;
grant execute on function public.start_store_conversation(uuid) to authenticated;
revoke all on function public.store_customer_balances(uuid) from public, anon, authenticated;
grant execute on function public.store_customer_balances(uuid) to authenticated;
revoke all on function public.store_customer_order_totals(uuid) from public, anon, authenticated;
grant execute on function public.store_customer_order_totals(uuid) to authenticated;
revoke all on function public.store_delivery_report(uuid, integer) from public, anon, authenticated;
grant execute on function public.store_delivery_report(uuid, integer) to authenticated;
revoke all on function public.store_effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.store_effective_plan(uuid) to authenticated;
revoke all on function public.store_has_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.store_has_plan(uuid, text) to authenticated;
revoke all on function public.store_margin_report(uuid, integer) from public, anon, authenticated;
grant execute on function public.store_margin_report(uuid, integer) to authenticated;
revoke all on function public.store_product_limit(uuid) from public, anon, authenticated;
grant execute on function public.store_product_limit(uuid) to authenticated;
revoke all on function public.unread_conversation_count() from public, anon, authenticated;
grant execute on function public.unread_conversation_count() to authenticated;
revoke all on function public.update_delivery_status(uuid, text) from public, anon, authenticated;
grant execute on function public.update_delivery_status(uuid, text) to authenticated;
revoke all on function public.update_lead_status(uuid, public.lead_status, uuid, text) from public, anon, authenticated;
grant execute on function public.update_lead_status(uuid, public.lead_status, uuid, text) to authenticated;
revoke all on function public.update_stay_status(uuid, public.stay_status) from public, anon, authenticated;
grant execute on function public.update_stay_status(uuid, public.stay_status) to authenticated;
revoke all on function public.void_invoice(uuid, text) from public, anon, authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;

-- ============================================================================
-- ROLLED-BACK TEST  (run against prod inside begin;…rollback; — it PASSED)
-- ============================================================================
-- Expected: RESULT PASS all privilege assertions hold
-- Asserted after the revokes: anon lost admin_attention_queue, the trigger
-- sample, issue_credit_note, my_conversations, store_has_plan; authenticated
-- kept my_conversations, store_has_plan, update_lead_status but lost
-- issue_credit_note and sync_plan_parking; service_role kept everything; and
-- anon still executes place_guest_order, create_lead, search_products_fuzzy,
-- clock_store_context, store_fulfilled_count, is_super_admin,
-- record_checkout_intent.
