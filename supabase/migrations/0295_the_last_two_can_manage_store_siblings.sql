-- Found by the RLS matrix in supabase/tests/, on its first real run — which is
-- the entire argument for having written it. 0291 fixed five tables that were
-- gated on can_manage_store (true for ANY staff row) instead of
-- staff_can(store_id, perm). These two are the same predicate and the same bug,
-- and I missed them: I went from a hand-made list, the suite went from
-- pg_policies.
--
--   accommodation_units.units_public_read       (active = true) or can_manage_store(...)
--   event_ticket_types.ticket_types_public_read (active = true) or can_manage_store(...)
--
-- A staff member with every permission switched off could read the store's
-- INACTIVE units and inactive ticket types — the ones held back from the
-- storefront, so drafts and prices not meant to be public yet. Milder than
-- 0291's customer phone numbers: intra-store only, cross-store and anon both
-- held. Still the toggle promising something the database did not enforce.
--
-- The `active = true` branch is untouched. That branch is the storefront: it is
-- what lets an anonymous visitor see a hotel's rooms and an event's tickets, and
-- removing it would empty those pages for the public. Verified rather than
-- assumed — anon still reads 4 active units after this change.
--
-- 'products' is the predicate because these are the things the shop sells, the
-- same category the products permission already governs. It is a judgement call:
-- the merchant screens for units, tickets and stays all gate on can_manage_store
-- at the page level, so the UI offered no answer, and there is no 'units' or
-- 'tickets' key in PERM_KEYS to map onto.
--
-- All four cases proven in rolled-back transactions before applying, including
-- the negative, which is the one that actually matters and the one an empty
-- table cannot give you:
--   staff products=true  -> sees inactive unit   (1)  positive control
--   OWNER                -> sees inactive unit   (1)  nobody lost anything
--   anon                 -> sees active units    (4)  storefront intact
--   staff products=FALSE -> sees inactive unit   (0)  the fix
--
-- Deliberately NOT swept further. The same query finds can_manage_store in the
-- SELECT qual of order_payments, booking_waitlist, course_enrollments,
-- service_requests, store_memberships, delivery_requests, stock_waitlist,
-- store_credit_notes, store_campaigns, coupons, automations, automation_runs and
-- product_imports, several carrying customer identity. Each needs a permission
-- chosen on its merits, the way 0291 chose per table; picking thirteen at once
-- to close a sweep is how a mapping nobody agreed to becomes precedent. They are
-- listed in the test file so the next person starts from a list rather than a
-- rediscovery.

drop policy if exists units_public_read on public.accommodation_units;
create policy units_public_read on public.accommodation_units for select
  using (active = true or public.staff_can(store_id, 'products'));

drop policy if exists ticket_types_public_read on public.event_ticket_types;
create policy ticket_types_public_read on public.event_ticket_types for select
  using (active = true or public.staff_can(store_id, 'products'));
