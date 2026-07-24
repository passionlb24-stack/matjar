-- Wholesale listings are for merchants only: a user must own a store to post a
-- wholesale offer. Enforced at the DB layer (not just the UI) so it can't be
-- bypassed. owns_store() is SECURITY DEFINER to avoid RLS recursion on stores.
create or replace function public.owns_store()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.stores s
    where s.owner_id = (select auth.uid()) and s.deleted_at is null
  );
$$;

drop policy if exists wholesale_insert on public.wholesale_products;
create policy wholesale_insert on public.wholesale_products
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and public.owns_store());
