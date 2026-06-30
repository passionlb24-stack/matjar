-- Granular per-staff permissions. Existing staff default to full access so
-- nothing they could do before breaks.
alter table public.store_staff
  add column if not exists permissions jsonb not null
  default '{"orders":true,"products":true,"bookings":true}'::jsonb;

-- True if the caller owns the store, or is a staff member with the named
-- permission. Security invoker (like can_manage_store): the inner reads run
-- under the caller's RLS (own store_staff row via store_staff_select_self).
create or replace function public.staff_can(p_store_id uuid, p_perm text)
returns boolean
language sql
stable
security invoker
set search_path to ''
as $function$
  select exists (
           select 1 from public.stores s
           where s.id = p_store_id and s.owner_id = auth.uid()
         )
      or exists (
           select 1 from public.store_staff st
           where st.store_id = p_store_id
             and st.user_id = auth.uid()
             and coalesce((st.permissions ->> p_perm)::boolean, false)
         );
$function$;

-- Re-point the staff policies at the permission-specific check.
drop policy orders_select_staff on public.orders;
create policy orders_select_staff on public.orders
  for select using (public.staff_can(store_id, 'orders'));
drop policy orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update using (public.staff_can(store_id, 'orders'))
  with check (public.staff_can(store_id, 'orders'));

drop policy bookings_select_staff on public.bookings;
create policy bookings_select_staff on public.bookings
  for select using (public.staff_can(store_id, 'bookings'));
drop policy bookings_update_staff on public.bookings;
create policy bookings_update_staff on public.bookings
  for update using (public.staff_can(store_id, 'bookings'))
  with check (public.staff_can(store_id, 'bookings'));

drop policy products_insert_staff on public.products;
create policy products_insert_staff on public.products
  for insert with check (public.staff_can(store_id, 'products'));
drop policy products_select_staff on public.products;
create policy products_select_staff on public.products
  for select using (public.staff_can(store_id, 'products'));
drop policy products_update_staff on public.products;
create policy products_update_staff on public.products
  for update using (public.staff_can(store_id, 'products'))
  with check (public.staff_can(store_id, 'products'));

-- Variant/option writes follow the product's 'products' permission.
drop policy product_variants_insert on public.product_variants;
create policy product_variants_insert on public.product_variants
  for insert to authenticated with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  );
drop policy product_variants_update on public.product_variants;
create policy product_variants_update on public.product_variants
  for update to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  );
drop policy product_variants_delete on public.product_variants;
create policy product_variants_delete on public.product_variants
  for delete to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  );

drop policy product_options_insert on public.product_options;
create policy product_options_insert on public.product_options
  for insert to authenticated with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  );
drop policy product_options_update on public.product_options;
create policy product_options_update on public.product_options
  for update to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  );
drop policy product_options_delete on public.product_options;
create policy product_options_delete on public.product_options
  for delete to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.staff_can(p.store_id, 'products'))
  );
