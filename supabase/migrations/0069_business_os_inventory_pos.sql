-- Business OS wave 2: inventory tracking + point of sale.
-- Inventory: per-product low-stock threshold + an auditable movement ledger.
-- POS: in-store cash sales recorded against the catalog, decrementing stock
-- atomically via a SECURITY DEFINER RPC (same trust model as place_guest_order:
-- prices are read server-side, never from the client).

-- ---- Inventory -------------------------------------------------------------

alter table public.products
  add column if not exists low_stock_threshold integer not null default 5;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  delta integer not null,
  reason text not null default 'adjustment'
    check (reason in ('sale', 'adjustment', 'purchase', 'return')),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_store_idx
  on public.stock_movements (store_id, created_at desc);
create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id);

alter table public.stock_movements enable row level security;

drop policy if exists stock_movements_manage on public.stock_movements;
create policy stock_movements_manage on public.stock_movements
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Set a product's stock to an absolute quantity, logging the delta.
create or replace function public.adjust_stock(
  p_product uuid,
  p_qty integer,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid;
  v_old integer;
begin
  select store_id, stock into v_store, v_old
  from public.products where id = p_product and deleted_at is null;
  if v_store is null then
    raise exception 'product not found';
  end if;
  if not public.can_manage_store(v_store) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_qty < 0 then
    raise exception 'quantity must be >= 0';
  end if;

  update public.products
    set stock = p_qty, updated_at = now()
    where id = p_product;

  insert into public.stock_movements (store_id, product_id, delta, reason, note, created_by)
  values (v_store, p_product, p_qty - coalesce(v_old, 0), 'adjustment', p_note, (select auth.uid()));
end $$;
revoke execute on function public.adjust_stock(uuid, integer, text) from public, anon;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

-- ---- Point of sale ----------------------------------------------------------

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  subtotal numeric(12, 2) not null,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'card')),
  customer_id uuid references public.store_customers (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pos_sales_store_idx
  on public.pos_sales (store_id, created_at desc);

alter table public.pos_sales enable row level security;

drop policy if exists pos_sales_manage on public.pos_sales;
create policy pos_sales_manage on public.pos_sales
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Line items snapshot name + price at sale time (catalog edits later must not
-- rewrite history).
create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  price numeric(12, 2) not null,
  qty integer not null check (qty > 0)
);
create index if not exists pos_sale_items_sale_idx
  on public.pos_sale_items (sale_id);

alter table public.pos_sale_items enable row level security;

drop policy if exists pos_sale_items_manage on public.pos_sale_items;
create policy pos_sale_items_manage on public.pos_sale_items
  for all to authenticated
  using (exists (
    select 1 from public.pos_sales s
    where s.id = sale_id and public.can_manage_store(s.store_id)
  ))
  with check (exists (
    select 1 from public.pos_sales s
    where s.id = sale_id and public.can_manage_store(s.store_id)
  ));

-- Record an in-store sale atomically: server-side prices, stock decrement,
-- movement log. p_items: [{"product_id": uuid, "qty": int}, …]
create or replace function public.pos_record_sale(
  p_store_id uuid,
  p_items jsonb,
  p_discount numeric default 0,
  p_customer uuid default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_item record;
  v_prod record;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_sale uuid;
  v_price numeric(12, 2);
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty sale';
  end if;
  if p_customer is not null and not exists (
    select 1 from public.store_customers c
    where c.id = p_customer and c.store_id = p_store_id
  ) then
    raise exception 'customer not in this store';
  end if;

  -- First pass: validate items + compute the subtotal from server-side prices.
  for v_item in
    select (e->>'product_id')::uuid as product_id, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'invalid quantity';
    end if;
    select id, coalesce(discount_price, price) as eff_price
      into v_prod
      from public.products
      where id = v_item.product_id and store_id = p_store_id
        and deleted_at is null;
    if v_prod.id is null then
      raise exception 'product not found in this store';
    end if;
    v_subtotal := v_subtotal + v_prod.eff_price * v_item.qty;
  end loop;

  if p_discount is null or p_discount < 0 or p_discount > v_subtotal then
    raise exception 'invalid discount';
  end if;
  v_total := v_subtotal - p_discount;

  insert into public.pos_sales
    (store_id, subtotal, discount, total, customer_id, note, created_by)
  values
    (p_store_id, v_subtotal, p_discount, v_total, p_customer, p_note, (select auth.uid()))
  returning id into v_sale;

  -- Second pass: snapshot lines, decrement tracked stock, log movements.
  for v_item in
    select (e->>'product_id')::uuid as product_id, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e
  loop
    select id, name, coalesce(discount_price, price) as eff_price, stock
      into v_prod
      from public.products
      where id = v_item.product_id;
    v_price := v_prod.eff_price;

    insert into public.pos_sale_items (sale_id, product_id, name, price, qty)
    values (v_sale, v_prod.id, v_prod.name, v_price, v_item.qty);

    if v_prod.stock is not null then
      update public.products
        set stock = greatest(v_prod.stock - v_item.qty, 0), updated_at = now()
        where id = v_prod.id;
      insert into public.stock_movements
        (store_id, product_id, delta, reason, created_by)
      values
        (p_store_id, v_prod.id, -v_item.qty, 'sale', (select auth.uid()));
    end if;
  end loop;

  return v_sale;
end $$;
revoke execute on function public.pos_record_sale(uuid, jsonb, numeric, uuid, text) from public, anon;
grant execute on function public.pos_record_sale(uuid, jsonb, numeric, uuid, text) to authenticated;
