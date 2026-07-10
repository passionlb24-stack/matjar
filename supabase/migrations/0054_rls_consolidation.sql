-- 0054: RLS performance cleanup.
--
-- Two Supabase performance-advisor items:
--   * multiple_permissive_policies (77 findings, 15 tables): several PERMISSIVE
--     policies apply to the same role+command, so Postgres evaluates each one
--     per row. We merge them into ONE policy per command whose condition is the
--     OR of the originals. PERMISSIVE policies are already OR'd, so this is
--     access-identical — no grant is widened or narrowed — just fewer policies
--     to evaluate.
--   * auth_rls_initplan (1 finding): addresses_delete_own calls auth.uid()
--     unwrapped (re-evaluated per row); wrap it as (select auth.uid()).
--
-- Every condition below is copied verbatim from the live policy definitions.
-- FOR ALL admin policies that overlapped a SELECT policy are split into explicit
-- INSERT/UPDATE/DELETE so they no longer cover SELECT.

-- ============================================================ addresses
-- Wrap auth.uid() (introduced unwrapped in 0052).
drop policy if exists addresses_delete_own on public.addresses;
create policy addresses_delete_own on public.addresses
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================ orders
drop policy if exists orders_select_admin on public.orders;
drop policy if exists orders_select_customer on public.orders;
drop policy if exists orders_select_staff on public.orders;
drop policy if exists orders_select_store on public.orders;
create policy orders_select on public.orders
  for select to public
  using (
    is_super_admin()
    or (select auth.uid()) = customer_id
    or staff_can(store_id, 'orders')
    or exists (select 1 from public.stores s
               where s.id = orders.store_id and s.owner_id = (select auth.uid()))
  );

drop policy if exists orders_update_staff on public.orders;
drop policy if exists orders_update_store on public.orders;
create policy orders_update on public.orders
  for update to public
  using (
    staff_can(store_id, 'orders')
    or exists (select 1 from public.stores s
               where s.id = orders.store_id and s.owner_id = (select auth.uid()))
  )
  with check (
    staff_can(store_id, 'orders')
    or exists (select 1 from public.stores s
               where s.id = orders.store_id and s.owner_id = (select auth.uid()))
  );

-- ============================================================ bookings
drop policy if exists bookings_select_admin on public.bookings;
drop policy if exists bookings_select_customer on public.bookings;
drop policy if exists bookings_select_staff on public.bookings;
drop policy if exists bookings_select_store on public.bookings;
create policy bookings_select on public.bookings
  for select to public
  using (
    is_super_admin()
    or (select auth.uid()) = customer_id
    or staff_can(store_id, 'bookings')
    or exists (select 1 from public.stores s
               where s.id = bookings.store_id and s.owner_id = (select auth.uid()))
  );

drop policy if exists bookings_update_staff on public.bookings;
drop policy if exists bookings_update_store on public.bookings;
create policy bookings_update on public.bookings
  for update to public
  using (
    staff_can(store_id, 'bookings')
    or exists (select 1 from public.stores s
               where s.id = bookings.store_id and s.owner_id = (select auth.uid()))
  )
  with check (
    staff_can(store_id, 'bookings')
    or exists (select 1 from public.stores s
               where s.id = bookings.store_id and s.owner_id = (select auth.uid()))
  );

-- ============================================================ products
drop policy if exists products_select_admin on public.products;
drop policy if exists products_select_own on public.products;
drop policy if exists products_select_public on public.products;
drop policy if exists products_select_staff on public.products;
create policy products_select on public.products
  for select to public
  using (
    is_super_admin()
    or exists (select 1 from public.stores s
               where s.id = products.store_id and s.owner_id = (select auth.uid()))
    or ((status = 'active'::product_status) and (deleted_at is null)
        and exists (select 1 from public.stores s
                    where s.id = products.store_id
                      and s.status = 'active'::store_status
                      and s.deleted_at is null))
    or staff_can(store_id, 'products')
  );

drop policy if exists products_insert_own on public.products;
drop policy if exists products_insert_staff on public.products;
create policy products_insert on public.products
  for insert to public
  with check (
    exists (select 1 from public.stores s
            where s.id = products.store_id and s.owner_id = (select auth.uid()))
    or staff_can(store_id, 'products')
  );

drop policy if exists products_update_own on public.products;
drop policy if exists products_update_staff on public.products;
create policy products_update on public.products
  for update to public
  using (
    exists (select 1 from public.stores s
            where s.id = products.store_id and s.owner_id = (select auth.uid()))
    or staff_can(store_id, 'products')
  )
  with check (
    exists (select 1 from public.stores s
            where s.id = products.store_id and s.owner_id = (select auth.uid()))
    or staff_can(store_id, 'products')
  );

-- ============================================================ stores
drop policy if exists stores_select_admin on public.stores;
drop policy if exists stores_select_own on public.stores;
drop policy if exists stores_select_public on public.stores;
create policy stores_select on public.stores
  for select to public
  using (
    is_super_admin()
    or (select auth.uid()) = owner_id
    or ((status = 'active'::store_status) and (deleted_at is null))
  );

drop policy if exists stores_update_admin on public.stores;
drop policy if exists stores_update_own on public.stores;
create policy stores_update on public.stores
  for update to public
  using (
    is_super_admin()
    or (select auth.uid()) = owner_id
  )
  with check (
    is_super_admin()
    or (select auth.uid()) = owner_id
  );

-- ============================================================ profiles
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select on public.profiles
  for select to public
  using (
    is_super_admin()
    or (select auth.uid()) = id
  );

drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update on public.profiles
  for update to public
  using (
    is_super_admin()
    or (select auth.uid()) = id
  )
  with check (
    is_super_admin()
    or (select auth.uid()) = id
  );

-- ============================================================ reviews
drop policy if exists reviews_delete_admin on public.reviews;
drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete on public.reviews
  for delete to public
  using (
    is_super_admin()
    or (select auth.uid()) = customer_id
  );

-- ============================================================ store_staff
-- Split the FOR ALL owner policy so it no longer overlaps the self-select.
drop policy if exists store_staff_owner_all on public.store_staff;
drop policy if exists store_staff_select_self on public.store_staff;
create policy store_staff_select on public.store_staff
  for select to public
  using (
    (user_id = (select auth.uid()))
    or exists (select 1 from public.stores s
               where s.id = store_staff.store_id and s.owner_id = (select auth.uid()))
  );
create policy store_staff_insert_owner on public.store_staff
  for insert to public
  with check (
    exists (select 1 from public.stores s
            where s.id = store_staff.store_id and s.owner_id = (select auth.uid()))
  );
create policy store_staff_update_owner on public.store_staff
  for update to public
  using (
    exists (select 1 from public.stores s
            where s.id = store_staff.store_id and s.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.stores s
            where s.id = store_staff.store_id and s.owner_id = (select auth.uid()))
  );
create policy store_staff_delete_owner on public.store_staff
  for delete to public
  using (
    exists (select 1 from public.stores s
            where s.id = store_staff.store_id and s.owner_id = (select auth.uid()))
  );

-- ============================================================ business_types
-- Merge the two SELECT policies; insert/update/delete admin stay as-is.
drop policy if exists business_types_select_active on public.business_types;
drop policy if exists business_types_select_admin on public.business_types;
create policy business_types_select on public.business_types
  for select to public
  using (
    (is_active = true)
    or is_super_admin()
  );

-- ============================================================ app_settings
-- select stays (true, already covers admin); split FOR ALL admin write.
drop policy if exists app_settings_write_admin on public.app_settings;
create policy app_settings_insert_admin on public.app_settings
  for insert to authenticated with check (is_super_admin());
create policy app_settings_update_admin on public.app_settings
  for update to authenticated using (is_super_admin()) with check (is_super_admin());
create policy app_settings_delete_admin on public.app_settings
  for delete to authenticated using (is_super_admin());

-- ============================================================ market_categories
-- select already includes is_super_admin(); split FOR ALL admin write.
drop policy if exists market_categories_write_admin on public.market_categories;
create policy market_categories_insert_admin on public.market_categories
  for insert to authenticated with check (is_super_admin());
create policy market_categories_update_admin on public.market_categories
  for update to authenticated using (is_super_admin()) with check (is_super_admin());
create policy market_categories_delete_admin on public.market_categories
  for delete to authenticated using (is_super_admin());

-- ============================================================ market_cities
drop policy if exists market_cities_admin_write on public.market_cities;
create policy market_cities_insert_admin on public.market_cities
  for insert to public with check (is_super_admin());
create policy market_cities_update_admin on public.market_cities
  for update to public using (is_super_admin()) with check (is_super_admin());
create policy market_cities_delete_admin on public.market_cities
  for delete to public using (is_super_admin());

-- ============================================================ market_regions
drop policy if exists market_regions_admin_write on public.market_regions;
create policy market_regions_insert_admin on public.market_regions
  for insert to public with check (is_super_admin());
create policy market_regions_update_admin on public.market_regions
  for update to public using (is_super_admin()) with check (is_super_admin());
create policy market_regions_delete_admin on public.market_regions
  for delete to public using (is_super_admin());

-- ============================================================ payments
drop policy if exists payments_write_admin on public.payments;
create policy payments_insert_admin on public.payments
  for insert to authenticated with check (is_super_admin());
create policy payments_update_admin on public.payments
  for update to authenticated using (is_super_admin()) with check (is_super_admin());
create policy payments_delete_admin on public.payments
  for delete to authenticated using (is_super_admin());

-- ============================================================ plans
drop policy if exists plans_write_admin on public.plans;
create policy plans_insert_admin on public.plans
  for insert to authenticated with check (is_super_admin());
create policy plans_update_admin on public.plans
  for update to authenticated using (is_super_admin()) with check (is_super_admin());
create policy plans_delete_admin on public.plans
  for delete to authenticated using (is_super_admin());

-- ============================================================ subscriptions
drop policy if exists subscriptions_write_admin on public.subscriptions;
create policy subscriptions_insert_admin on public.subscriptions
  for insert to authenticated with check (is_super_admin());
create policy subscriptions_update_admin on public.subscriptions
  for update to authenticated using (is_super_admin()) with check (is_super_admin());
create policy subscriptions_delete_admin on public.subscriptions
  for delete to authenticated using (is_super_admin());
