-- Found while building 0301, outside that change's territory, so it is here.
--
-- store_locations gated its writes on can_manage_store(store_id) — true for ANY
-- store_staff row. So a staff member hired to manage products could edit a
-- branch's phone number, which is the number a customer calls, and its address,
-- which is where a customer drives.
--
-- Proven rather than read: as the one real staff row in production, permissions
-- {orders:false, bookings:false, products:true}, an UPDATE of a seeded branch's
-- phone reported rows=1.
--
-- INSERT looked blocked, and that was misleading in a way worth writing down.
-- The same staffer was refused with `plan_required:business` — a *plan* check
-- from the enforce_branch_plan trigger, not RLS. On a Business store, which is
-- the plan every merchant with more than one branch is on, that refusal
-- disappears and the same staffer can create branches. A guard that only holds
-- on the plans that cannot use the feature is not a guard.
--
-- is_store_owner, not staff_can(...): the app already decided this. The branches
-- page reads owner_id and compares it to the session, so branch management is
-- owner-only in the UI and the database simply did not say so. There is no
-- branch permission in PERM_KEYS to map onto, and inventing an eleventh key to
-- describe a screen no staff member can open would be describing a product that
-- does not exist.
--
-- SELECT is deliberately untouched: it carries the public branch list for the
-- storefront. Verified after the change that anon still reads it — narrowing a
-- read here would empty the branch list on every multi-branch store page, and
-- applying a narrowing ahead of its deploy is what took the reviews block off
-- every store page earlier today.
--
-- All three cases proven in a rolled-back transaction before applying:
--   products-only staff UPDATE -> 0 rows   (was 1)
--   OWNER UPDATE               -> 1 row    (unchanged)
--   anon SELECT                -> 2 rows   (storefront intact)

drop policy if exists store_locations_insert on public.store_locations;
create policy store_locations_insert on public.store_locations for insert
  with check (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists store_locations_update on public.store_locations;
create policy store_locations_update on public.store_locations for update
  using (public.is_store_owner(store_id) or public.is_super_admin())
  with check (public.is_store_owner(store_id) or public.is_super_admin());

drop policy if exists store_locations_delete on public.store_locations;
create policy store_locations_delete on public.store_locations for delete
  using (public.is_store_owner(store_id) or public.is_super_admin());
