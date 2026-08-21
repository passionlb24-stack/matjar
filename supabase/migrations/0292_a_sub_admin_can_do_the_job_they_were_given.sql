-- ISS-003. Migration 0149 introduced admin_can(section) and re-pointed the UGC
-- moderation tables at it. The rest of the admin-managed tables were never
-- migrated, so a sub-admin's capability is decided by which migration happened
-- to touch a table rather than by what they were granted.
--
-- Today's impact is nil: production has one super_admin and zero sub-admins.
-- This is a capability bug, not an exposure, and it fails CLOSED — a sub-admin
-- granted "verifications" opens the queue and sees an empty list, because
-- store_verifications_manage tests `is_store_owner OR is_super_admin`. The cost
-- is discontinuous: it lands entirely on the day the owner first delegates.
--
-- ── why every statement here is safe against the DEPLOYED build ─────────────
-- admin_can(section) is `role = 'super_admin' OR admin_permissions ? section`,
-- so admin_can(x) is TRUE wherever is_super_admin() is TRUE, for every x. Every
-- rewrite below therefore only ADDS sub-admins to an allowed set; nothing that
-- can pass today stops passing. That is the opposite shape of the revoke that
-- took the reviews block off every store page earlier today, and it is why
-- these can land ahead of any deploy. Verified in a rolled-back transaction
-- against production first: the super-admin column of the access matrix is
-- byte-identical before and after, and the anon column is byte-identical too.
--
-- ── table → section, and where the mapping was a judgement call ─────────────
-- The section key is not guessed: it is the key the page that renders the table
-- passes to requireAdminSection() in src/lib/admin-guard.ts, which is the same
-- key the nav gates on and the same key the roles editor writes. Three of them
-- are not obvious and are called out:
--
--   listing_reports → 'market', NOT 'reports'. The screen is
--     /admin/market/reports (requireAdminSection("market")). 'reports' is
--     /admin/reports, the platform analytics dashboard, which touches no table
--     here — its two RPCs already gate on admin_can.
--   payments → 'subscriptions'. There is no 'payments' section key. The only
--     admin surface that reads or writes payments is
--     /admin/subscriptions/page.tsx + admin-subs-client.tsx.
--   plans → 'subscriptions'. Judgement call with NO deployed call site at all:
--     there is no `from("plans")` anywhere in src/. The pricing page renders a
--     hardcoded PlanConfig record and merchant membership tiers live in
--     store_membership_plans. Aligned for consistency; inert until something
--     reads it.
--
-- Two tables are touched that were not on the original ISS-003 list, because
-- re-deriving from pg_policies showed the list would not actually work:
--   store_verification_docs — /admin/verifications embeds
--     store_verification_docs(doc_url). Fixing store_verifications alone gives
--     a sub-admin a queue of rows with no document to look at.
--   set_store_status() — not a policy at all. It is SECURITY DEFINER and gates
--     internally on is_super_admin(), and it is the ONLY path by which the
--     admin stores screen changes a store's status (0282 routed it there so a
--     suspension cannot be recorded without a reason). Fixing stores_update
--     without it would leave a 'stores' sub-admin able to edit a plan but not
--     suspend anyone. Replaced with `create or replace` at the IDENTICAL
--     signature — no new parameter, no drop — so no overload can appear.

-- ── stores → 'stores' ───────────────────────────────────────────────────────
-- The admin list needs pending/suspended/deleted stores, which the public arm
-- of the SELECT excludes; the owner arm is left exactly as it was.
drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores
  for select using (
    public.admin_can('stores')
    or (select auth.uid()) = owner_id
    or (status = 'active'::public.store_status and deleted_at is null)
  );

drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores
  for update
  using (public.admin_can('stores') or (select auth.uid()) = owner_id)
  with check (public.admin_can('stores') or (select auth.uid()) = owner_id);

-- Body reproduced verbatim from 0282 with one line changed
-- (`is_super_admin()` → `admin_can('stores')`). Same signature, so this
-- replaces rather than overloads.
create or replace function public.set_store_status(
  p_store_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old    public.store_status;
  v_reason text;
  v_row    public.stores%rowtype;
begin
  if not public.admin_can('stores') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_status not in ('pending', 'active', 'suspended', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'unknown_status');
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if p_status in ('pending', 'active') then
    v_reason := null;
  end if;

  if p_status in ('suspended', 'rejected') and v_reason is null then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    return jsonb_build_object('ok', false, 'error', 'reason_too_long', 'max', 500);
  end if;

  select * into v_row from public.stores
   where id = p_store_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_old := v_row.status;

  update public.stores
     set status        = p_status::public.store_status,
         status_reason = v_reason
   where id = p_store_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'changed', v_old is distinct from v_row.status,
    'from', v_old,
    'status', v_row.status,
    'reason', v_row.status_reason,
    'changed_at', v_row.status_changed_at,
    'changed_by', v_row.status_changed_by
  );
end
$function$;

revoke all on function public.set_store_status(uuid, text, text) from public, anon;
grant execute on function public.set_store_status(uuid, text, text) to authenticated;

-- ── store_verifications + docs → 'verifications' ────────────────────────────
-- The is_store_owner arm is the merchant submitting their own paperwork and is
-- untouched; only the admin arm moves.
drop policy if exists store_verifications_manage on public.store_verifications;
create policy store_verifications_manage on public.store_verifications
  for all
  using (public.is_store_owner(store_id) or public.admin_can('verifications'))
  with check (public.is_store_owner(store_id) or public.admin_can('verifications'));

drop policy if exists store_verification_docs_manage on public.store_verification_docs;
create policy store_verification_docs_manage on public.store_verification_docs
  for all
  using (public.is_store_owner(store_id) or public.admin_can('verifications'))
  with check (public.is_store_owner(store_id) or public.admin_can('verifications'));

-- ── reviews → 'reviews' ─────────────────────────────────────────────────────
-- Only the delete carries an admin arm; reviews_select_public is already
-- `true`, and the owner-reply and author-edit policies are not admin paths.
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete using (
    public.admin_can('reviews') or (select auth.uid()) = customer_id
  );

-- ── market_categories / market_cities / market_regions → 'market' ───────────
drop policy if exists market_categories_select on public.market_categories;
create policy market_categories_select on public.market_categories
  for select using (is_active or public.admin_can('market'));
drop policy if exists market_categories_insert_admin on public.market_categories;
create policy market_categories_insert_admin on public.market_categories
  for insert to authenticated with check (public.admin_can('market'));
drop policy if exists market_categories_update_admin on public.market_categories;
create policy market_categories_update_admin on public.market_categories
  for update to authenticated
  using (public.admin_can('market')) with check (public.admin_can('market'));
drop policy if exists market_categories_delete_admin on public.market_categories;
create policy market_categories_delete_admin on public.market_categories
  for delete to authenticated using (public.admin_can('market'));

drop policy if exists market_cities_select_active on public.market_cities;
create policy market_cities_select_active on public.market_cities
  for select using (is_active or public.admin_can('market'));
drop policy if exists market_cities_insert_admin on public.market_cities;
create policy market_cities_insert_admin on public.market_cities
  for insert with check (public.admin_can('market'));
drop policy if exists market_cities_update_admin on public.market_cities;
create policy market_cities_update_admin on public.market_cities
  for update using (public.admin_can('market')) with check (public.admin_can('market'));
drop policy if exists market_cities_delete_admin on public.market_cities;
create policy market_cities_delete_admin on public.market_cities
  for delete using (public.admin_can('market'));

drop policy if exists market_regions_select_active on public.market_regions;
create policy market_regions_select_active on public.market_regions
  for select using (is_active or public.admin_can('market'));
drop policy if exists market_regions_insert_admin on public.market_regions;
create policy market_regions_insert_admin on public.market_regions
  for insert with check (public.admin_can('market'));
drop policy if exists market_regions_update_admin on public.market_regions;
create policy market_regions_update_admin on public.market_regions
  for update using (public.admin_can('market')) with check (public.admin_can('market'));
drop policy if exists market_regions_delete_admin on public.market_regions;
create policy market_regions_delete_admin on public.market_regions
  for delete using (public.admin_can('market'));

-- listing_reports lives at /admin/market/reports — section 'market'. The
-- reporter-side INSERT policy (rate limited, own uid) is untouched.
drop policy if exists listing_reports_select_admin on public.listing_reports;
create policy listing_reports_select_admin on public.listing_reports
  for select to authenticated using (public.admin_can('market'));
drop policy if exists listing_reports_update_admin on public.listing_reports;
create policy listing_reports_update_admin on public.listing_reports
  for update to authenticated
  using (public.admin_can('market')) with check (public.admin_can('market'));

-- ── business_types → 'types' ────────────────────────────────────────────────
drop policy if exists business_types_select on public.business_types;
create policy business_types_select on public.business_types
  for select using (is_active = true or public.admin_can('types'));
drop policy if exists business_types_insert_admin on public.business_types;
create policy business_types_insert_admin on public.business_types
  for insert to authenticated with check (public.admin_can('types'));
drop policy if exists business_types_update_admin on public.business_types;
create policy business_types_update_admin on public.business_types
  for update to authenticated
  using (public.admin_can('types')) with check (public.admin_can('types'));
drop policy if exists business_types_delete_admin on public.business_types;
create policy business_types_delete_admin on public.business_types
  for delete to authenticated using (public.admin_can('types'));

-- ── delivery_companies → 'delivery' ─────────────────────────────────────────
drop policy if exists delivery_companies_select on public.delivery_companies;
create policy delivery_companies_select on public.delivery_companies
  for select using (is_active or public.admin_can('delivery'));
drop policy if exists delivery_companies_insert_admin on public.delivery_companies;
create policy delivery_companies_insert_admin on public.delivery_companies
  for insert to authenticated with check (public.admin_can('delivery'));
drop policy if exists delivery_companies_update_admin on public.delivery_companies;
create policy delivery_companies_update_admin on public.delivery_companies
  for update to authenticated
  using (public.admin_can('delivery')) with check (public.admin_can('delivery'));
drop policy if exists delivery_companies_delete_admin on public.delivery_companies;
create policy delivery_companies_delete_admin on public.delivery_companies
  for delete to authenticated using (public.admin_can('delivery'));

-- ── business_leaders → 'leaders' ────────────────────────────────────────────
-- One FOR ALL policy; the public read (published only) and the member
-- submission policy are separate and untouched.
drop policy if exists business_leaders_admin on public.business_leaders;
create policy business_leaders_admin on public.business_leaders
  for all
  using (public.admin_can('leaders')) with check (public.admin_can('leaders'));

-- ── app_settings → 'settings' ───────────────────────────────────────────────
-- app_settings_select is `true` for everyone and stays that way; the storefront
-- reads the LBP rate from it on every page.
drop policy if exists app_settings_insert_admin on public.app_settings;
create policy app_settings_insert_admin on public.app_settings
  for insert to authenticated with check (public.admin_can('settings'));
drop policy if exists app_settings_update_admin on public.app_settings;
create policy app_settings_update_admin on public.app_settings
  for update to authenticated
  using (public.admin_can('settings')) with check (public.admin_can('settings'));
drop policy if exists app_settings_delete_admin on public.app_settings;
create policy app_settings_delete_admin on public.app_settings
  for delete to authenticated using (public.admin_can('settings'));

-- ── subscriptions / payments / plans → 'subscriptions' ──────────────────────
-- 0291 made these SELECTs `is_super_admin() OR is_store_owner(store_id)` on
-- purpose: what a shop pays Matjar is the owner's business. That disjunct is
-- carried through untouched. Only the admin arm becomes granular — the read
-- has to move with the write, or a 'subscriptions' sub-admin gets the worst
-- possible outcome: able to record a payment against a list it cannot see.
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (
    public.admin_can('subscriptions') or public.is_store_owner(store_id)
  );
drop policy if exists subscriptions_insert_admin on public.subscriptions;
create policy subscriptions_insert_admin on public.subscriptions
  for insert to authenticated with check (public.admin_can('subscriptions'));
drop policy if exists subscriptions_update_admin on public.subscriptions;
create policy subscriptions_update_admin on public.subscriptions
  for update to authenticated
  using (public.admin_can('subscriptions'))
  with check (public.admin_can('subscriptions'));
drop policy if exists subscriptions_delete_admin on public.subscriptions;
create policy subscriptions_delete_admin on public.subscriptions
  for delete to authenticated using (public.admin_can('subscriptions'));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (
    public.admin_can('subscriptions') or public.is_store_owner(store_id)
  );
drop policy if exists payments_insert_admin on public.payments;
create policy payments_insert_admin on public.payments
  for insert to authenticated with check (public.admin_can('subscriptions'));
drop policy if exists payments_update_admin on public.payments;
create policy payments_update_admin on public.payments
  for update to authenticated
  using (public.admin_can('subscriptions'))
  with check (public.admin_can('subscriptions'));
drop policy if exists payments_delete_admin on public.payments;
create policy payments_delete_admin on public.payments
  for delete to authenticated using (public.admin_can('subscriptions'));

drop policy if exists plans_select_public on public.plans;
create policy plans_select_public on public.plans
  for select using (is_active or public.admin_can('subscriptions'));
drop policy if exists plans_insert_admin on public.plans;
create policy plans_insert_admin on public.plans
  for insert to authenticated with check (public.admin_can('subscriptions'));
drop policy if exists plans_update_admin on public.plans;
create policy plans_update_admin on public.plans
  for update to authenticated
  using (public.admin_can('subscriptions'))
  with check (public.admin_can('subscriptions'));
drop policy if exists plans_delete_admin on public.plans;
create policy plans_delete_admin on public.plans
  for delete to authenticated using (public.admin_can('subscriptions'));
