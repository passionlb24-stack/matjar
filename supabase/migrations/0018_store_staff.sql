-- Section 8 — merchant staff: a store owner can grant team members access.
create table public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);
create index store_staff_user_idx on public.store_staff (user_id);

alter table public.store_staff enable row level security;

create policy "store_staff_select_self"
  on public.store_staff for select
  using (user_id = auth.uid());

create policy "store_staff_owner_all"
  on public.store_staff for all
  using (
    exists (select 1 from public.stores s
            where s.id = store_staff.store_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.stores s
            where s.id = store_staff.store_id and s.owner_id = auth.uid())
  );

create or replace function public.can_manage_store(p_store_id uuid)
returns boolean language sql security invoker stable set search_path = '' as $$
  select exists (select 1 from public.stores s
                 where s.id = p_store_id and s.owner_id = auth.uid())
      or exists (select 1 from public.store_staff st
                 where st.store_id = p_store_id and st.user_id = auth.uid());
$$;

create or replace function public.add_store_staff(
  p_store_id uuid, p_email text, p_role text default 'staff'
) returns text language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if not exists (select 1 from public.stores s
                 where s.id = p_store_id and s.owner_id = auth.uid()) then
    return 'not_owner';
  end if;
  select id into v_user_id from auth.users
    where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then return 'not_found'; end if;
  if v_user_id = auth.uid() then return 'self'; end if;
  insert into public.store_staff (store_id, user_id, email, role)
  values (p_store_id, v_user_id, p_email, coalesce(nullif(p_role, ''), 'staff'))
  on conflict (store_id, user_id) do nothing;
  return 'ok';
end; $$;
revoke execute on function public.add_store_staff(uuid, text, text) from public, anon;

create policy "orders_select_staff" on public.orders for select
  using (public.can_manage_store(orders.store_id));
create policy "orders_update_staff" on public.orders for update
  using (public.can_manage_store(orders.store_id))
  with check (public.can_manage_store(orders.store_id));
create policy "bookings_select_staff" on public.bookings for select
  using (public.can_manage_store(bookings.store_id));
create policy "bookings_update_staff" on public.bookings for update
  using (public.can_manage_store(bookings.store_id))
  with check (public.can_manage_store(bookings.store_id));
create policy "products_select_staff" on public.products for select
  using (public.can_manage_store(products.store_id));
create policy "products_insert_staff" on public.products for insert
  with check (public.can_manage_store(products.store_id));
create policy "products_update_staff" on public.products for update
  using (public.can_manage_store(products.store_id))
  with check (public.can_manage_store(products.store_id));
