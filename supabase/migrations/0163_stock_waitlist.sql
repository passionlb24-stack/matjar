-- Back-in-stock waitlist ("notify me when available"). A signed-in customer on
-- a sold-out product joins the list; when the merchant restocks it (stock goes
-- positive or is_available flips true), everyone waiting gets an in-app
-- notification automatically. Login-required — an in-app notification is the
-- guaranteed delivery channel (we have no SMS), and it avoids storing guest PII.

create table if not exists public.stock_waitlist (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (product_id, user_id)
);

-- Partial index: the hot query is "who is still waiting for this product".
create index if not exists stock_waitlist_active_idx
  on public.stock_waitlist (product_id) where notified_at is null;

alter table public.stock_waitlist enable row level security;

-- Customer sees / removes their own entries.
create policy "stock_waitlist_select_own" on public.stock_waitlist
  for select using (user_id = auth.uid());
create policy "stock_waitlist_delete_own" on public.stock_waitlist
  for delete using (user_id = auth.uid());
-- Merchant/staff can read the waitlist for their own store's products (count).
create policy "stock_waitlist_select_store" on public.stock_waitlist
  for select using (public.can_manage_store(store_id));

-- Join via RPC so store_id is resolved server-side from the product (the client
-- can't spoof it) and only real, sold-out products can be watched.
create or replace function public.join_stock_waitlist(p_product_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_stock int; v_available boolean;
begin
  if auth.uid() is null then return 'auth'; end if;
  select store_id, stock, is_available into v_store, v_stock, v_available
    from public.products
   where id = p_product_id and status = 'active' and deleted_at is null;
  if v_store is null then return 'not_found'; end if;
  -- Only meaningful while it's actually unavailable.
  if v_available and (v_stock is null or v_stock > 0) then
    return 'in_stock';
  end if;
  insert into public.stock_waitlist (store_id, product_id, user_id)
  values (v_store, p_product_id, auth.uid())
  on conflict (product_id, user_id)
    do update set notified_at = null, created_at = now();
  return 'ok';
end $$;

revoke execute on function public.join_stock_waitlist(uuid) from public, anon;
grant execute on function public.join_stock_waitlist(uuid) to authenticated;

-- When a product transitions from unavailable → available, notify every
-- un-notified waiter and stamp them so they aren't told twice.
create or replace function public.notify_restock()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_was_unavailable boolean :=
    (old.is_available = false) or (old.stock is not null and old.stock <= 0);
  v_now_available boolean :=
    (new.is_available = true) and (new.stock is null or new.stock > 0);
begin
  if v_was_unavailable and v_now_available then
    insert into public.notifications (user_id, type, data)
    select w.user_id, 'restock',
           jsonb_build_object('product_id', new.id, 'store_id', new.store_id,
                              'product_name', new.name)
      from public.stock_waitlist w
     where w.product_id = new.id and w.notified_at is null;

    update public.stock_waitlist
       set notified_at = now()
     where product_id = new.id and notified_at is null;
  end if;
  return new;
end $$;

drop trigger if exists products_restock_notify on public.products;
create trigger products_restock_notify
  after update of stock, is_available on public.products
  for each row execute function public.notify_restock();

-- Merchant-facing: how many people are waiting on a product (active only).
create or replace function public.product_waitlist_count(p_product_id uuid)
returns int language sql security definer set search_path = '' as $$
  select count(*)::int from public.stock_waitlist w
   where w.product_id = p_product_id and w.notified_at is null
     and public.can_manage_store(w.store_id);
$$;
revoke execute on function public.product_waitlist_count(uuid) from public, anon;
grant execute on function public.product_waitlist_count(uuid) to authenticated;
