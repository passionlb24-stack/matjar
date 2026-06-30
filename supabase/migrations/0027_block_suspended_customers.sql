-- A suspended customer (profiles.is_active = false) must not be able to place
-- orders, bookings, or reviews. Enforce it at the data layer, not just the UI.
create or replace function public.user_is_active()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select is_active from public.profiles where id = auth.uid()),
    true
  );
$function$;

drop policy orders_insert_customer on public.orders;
create policy orders_insert_customer on public.orders
  for insert to authenticated
  with check (auth.uid() = customer_id and public.user_is_active());

drop policy bookings_insert_customer on public.bookings;
create policy bookings_insert_customer on public.bookings
  for insert to authenticated
  with check (auth.uid() = customer_id and public.user_is_active());

drop policy reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (auth.uid() = customer_id and public.user_is_active());
