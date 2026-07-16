-- Branches wave B: stamp every transaction with the branch it happened at.
-- 0084 made branches (store_locations) exist; this makes the money movements
-- point at one: orders.location_id + pos_sales.location_id. Resolution happens
-- inside the SECURITY DEFINER RPCs (never trust the client):
--   * an explicitly chosen branch must belong to the store and be active,
--     else `bad_location`;
--   * no branch chosen -> default to the store's primary active branch (may be
--     null for stores with no branch rows -- fine, the column is nullable).
-- Stock stays shared across branches (deliberate v1 choice, see 0084).
--
-- Signature note: `create or replace` with a different parameter list creates
-- an OVERLOAD -- PostgREST then rejects calls as ambiguous -- so each RPC is
-- dropped by its exact old signature and recreated with a trailing
-- `p_location_id uuid default null` (old callers keep working unchanged).
-- Drop + recreate resets the function ACL, so grants are restated explicitly.

-- ---- Columns ------------------------------------------------------------------

alter table public.orders
  add column location_id uuid references public.store_locations (id) on delete set null;
create index orders_location_idx on public.orders (location_id);

alter table public.pos_sales
  add column location_id uuid references public.store_locations (id) on delete set null;
create index pos_sales_location_idx on public.pos_sales (location_id);

-- ---- Guest checkout -------------------------------------------------------------
-- Body identical to 0081 (including its rate-limit block) apart from the branch
-- resolution + stamping.

drop function if exists public.place_guest_order(uuid, text, text, text, text, text, text, jsonb);

create or replace function public.place_guest_order(
  p_store_id uuid,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_fulfillment text,
  p_note text,
  p_coupon text,
  p_items jsonb,
  p_location_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product record;
  v_qty int;
  v_unit numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_coupon record;
  v_valid_items jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_location_id uuid;
begin
  -- Store must be live.
  if not exists (
    select 1 from public.stores
    where id = p_store_id and status = 'active' and deleted_at is null
  ) then
    raise exception 'store_unavailable';
  end if;

  -- Input hygiene.
  if p_phone is null or length(trim(p_phone)) < 4 then
    raise exception 'phone_required';
  end if;
  if p_fulfillment not in ('delivery', 'pickup') then
    raise exception 'bad_fulfillment';
  end if;
  if p_fulfillment = 'delivery'
     and (p_address is null or length(trim(p_address)) = 0) then
    raise exception 'address_required';
  end if;
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;

  -- Branch: an explicit choice must be a live branch of this store; otherwise
  -- default to the primary branch (null when the store has none -- fine).
  if p_location_id is not null then
    if not exists (
      select 1 from public.store_locations
      where id = p_location_id and store_id = p_store_id and is_active = true
    ) then
      raise exception 'bad_location';
    end if;
    v_location_id := p_location_id;
  else
    select id into v_location_id
    from public.store_locations
    where store_id = p_store_id and is_primary = true and is_active = true
    limit 1;
  end if;

  -- Rate limit: at most 5 guest orders per (store, phone) per hour.
  if (
    select count(*) from public.orders
    where store_id = p_store_id
      and customer_id is null
      and phone = trim(p_phone)
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  -- Recompute the subtotal from live prices; reject anything not on sale here.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_qty > 1000 then
      raise exception 'bad_quantity';
    end if;
    select id, name, price, discount_price into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and store_id = p_store_id
      and status = 'active'
      and is_available = true
      and deleted_at is null;
    if not found then
      raise exception 'product_unavailable';
    end if;
    v_unit := coalesce(v_product.discount_price, v_product.price);
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_valid_items := v_valid_items || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'unit_price', v_unit,
      'quantity', v_qty
    );
  end loop;

  -- Coupon: server-validated; silently ignored if invalid.
  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon
    from public.validate_coupon(p_store_id, upper(trim(p_coupon)), v_subtotal);
    if v_coupon.valid then
      v_discount := coalesce(v_coupon.discount, 0);
    end if;
  end if;

  insert into public.orders (
    store_id, customer_id, customer_name, phone, address, fulfillment,
    customer_note, subtotal, discount, total, coupon_code, status, location_id
  ) values (
    p_store_id, null, nullif(trim(p_customer_name), ''), trim(p_phone),
    nullif(trim(p_address), ''), p_fulfillment::public.fulfillment_type,
    nullif(trim(p_note), ''), v_subtotal, v_discount,
    greatest(0, v_subtotal - v_discount),
    case when v_discount > 0 then upper(trim(p_coupon)) else null end,
    'pending', v_location_id
  ) returning id into v_order_id;

  -- Firing order_items_decrement_stock per row (oversell rolls back the whole txn).
  insert into public.order_items (order_id, product_id, name, unit_price, quantity)
  select v_order_id,
         (e->>'product_id')::uuid,
         e->>'name',
         (e->>'unit_price')::numeric,
         (e->>'quantity')::int
  from jsonb_array_elements(v_valid_items) e;

  return v_order_id;
end;
$$;

revoke execute on function public.place_guest_order(
  uuid, text, text, text, text, text, text, jsonb, uuid
) from public;
grant execute on function public.place_guest_order(
  uuid, text, text, text, text, text, text, jsonb, uuid
) to anon, authenticated;

-- ---- Authenticated checkout -----------------------------------------------------
-- Body identical to 0073 apart from the branch resolution + stamping.

drop function if exists public.place_customer_order(uuid, text, text, text, text, text, jsonb);

create or replace function public.place_customer_order(
  p_store_id uuid,
  p_phone text,
  p_address text,
  p_fulfillment text,
  p_note text,
  p_coupon text,
  p_items jsonb,
  p_location_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_product record;
  v_variant record;
  v_qty int;
  v_unit numeric(12, 2);
  v_addons numeric(12, 2);
  v_addon_names text;
  v_name text;
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_coupon record;
  v_valid_items jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_customer_name text;
  v_location_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.stores
    where id = p_store_id and status = 'active' and deleted_at is null
  ) then
    raise exception 'store_unavailable';
  end if;

  if p_fulfillment not in ('delivery', 'pickup') then
    raise exception 'bad_fulfillment';
  end if;
  if p_fulfillment = 'delivery'
     and (p_address is null or length(trim(p_address)) = 0) then
    raise exception 'address_required';
  end if;
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;

  -- Branch: an explicit choice must be a live branch of this store; otherwise
  -- default to the primary branch (null when the store has none -- fine).
  if p_location_id is not null then
    if not exists (
      select 1 from public.store_locations
      where id = p_location_id and store_id = p_store_id and is_active = true
    ) then
      raise exception 'bad_location';
    end if;
    v_location_id := p_location_id;
  else
    select id into v_location_id
    from public.store_locations
    where store_id = p_store_id and is_primary = true and is_active = true
    limit 1;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_qty > 1000 then
      raise exception 'bad_quantity';
    end if;

    select id, name, price, discount_price into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and store_id = p_store_id
      and status = 'active'
      and is_available = true
      and deleted_at is null;
    if not found then
      raise exception 'product_unavailable';
    end if;

    v_unit := coalesce(v_product.discount_price, v_product.price);
    v_name := v_product.name;

    -- Variant: must belong to this product; its price (when set) replaces the base.
    if v_item->>'variant_id' is not null then
      select id, label, price, is_available into v_variant
      from public.product_variants
      where id = (v_item->>'variant_id')::uuid
        and product_id = v_product.id;
      if not found or not v_variant.is_available then
        raise exception 'variant_unavailable';
      end if;
      v_unit := coalesce(v_variant.price, v_unit);
      v_name := v_name || ' - ' || v_variant.label;
    end if;

    -- Add-ons: each must belong to this product; prices summed server-side.
    v_addons := 0;
    v_addon_names := null;
    if v_item ? 'addon_ids'
       and jsonb_typeof(v_item->'addon_ids') = 'array'
       and jsonb_array_length(v_item->'addon_ids') > 0 then
      select coalesce(sum(o.price), 0), string_agg(o.name, ', ')
        into v_addons, v_addon_names
      from public.product_options o
      where o.product_id = v_product.id
        and o.id in (
          select (a.value #>> '{}')::uuid
          from jsonb_array_elements(v_item->'addon_ids') a
        );
      if v_addon_names is null then
        raise exception 'addon_unavailable';
      end if;
      v_name := v_name || ' (+ ' || v_addon_names || ')';
    end if;

    v_unit := v_unit + v_addons;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_valid_items := v_valid_items || jsonb_build_object(
      'product_id', v_product.id,
      'variant_id', v_item->>'variant_id',
      'name', v_name,
      'unit_price', v_unit,
      'quantity', v_qty
    );
  end loop;

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon
    from public.validate_coupon(p_store_id, upper(trim(p_coupon)), v_subtotal);
    if v_coupon.valid then
      v_discount := coalesce(v_coupon.discount, 0);
    end if;
  end if;

  select full_name into v_customer_name
  from public.profiles where id = v_uid;

  insert into public.orders (
    store_id, customer_id, customer_name, phone, address, fulfillment,
    customer_note, subtotal, discount, total, coupon_code, status, location_id
  ) values (
    p_store_id, v_uid, v_customer_name, nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    p_fulfillment::public.fulfillment_type,
    nullif(trim(coalesce(p_note, '')), ''), v_subtotal, v_discount,
    greatest(0, v_subtotal - v_discount),
    case when v_discount > 0 then upper(trim(p_coupon)) else null end,
    'pending', v_location_id
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, variant_id, name, unit_price, quantity)
  select v_order_id,
         (e->>'product_id')::uuid,
         (e->>'variant_id')::uuid,
         e->>'name',
         (e->>'unit_price')::numeric,
         (e->>'quantity')::int
  from jsonb_array_elements(v_valid_items) e;

  return v_order_id;
end;
$$;

revoke execute on function public.place_customer_order(
  uuid, text, text, text, text, text, jsonb, uuid
) from public, anon;
grant execute on function public.place_customer_order(
  uuid, text, text, text, text, text, jsonb, uuid
) to authenticated;

-- ---- Point of sale ----------------------------------------------------------
-- The POS terminal records sales through pos_record_sale (the only writer of
-- pos_sales rows), so the branch has to travel through it too. Body identical
-- to 0069 apart from the branch resolution + stamping.

drop function if exists public.pos_record_sale(uuid, jsonb, numeric, uuid, text);

create or replace function public.pos_record_sale(
  p_store_id uuid,
  p_items jsonb,
  p_discount numeric default 0,
  p_customer uuid default null,
  p_note text default null,
  p_location_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_item record;
  v_prod record;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_sale uuid;
  v_price numeric(12, 2);
  v_location_id uuid;
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

  -- Branch: an explicit choice must be a live branch of this store; otherwise
  -- default to the primary branch (null when the store has none -- fine).
  if p_location_id is not null then
    if not exists (
      select 1 from public.store_locations
      where id = p_location_id and store_id = p_store_id and is_active = true
    ) then
      raise exception 'bad_location';
    end if;
    v_location_id := p_location_id;
  else
    select id into v_location_id
    from public.store_locations
    where store_id = p_store_id and is_primary = true and is_active = true
    limit 1;
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
    (store_id, subtotal, discount, total, customer_id, note, created_by, location_id)
  values
    (p_store_id, v_subtotal, p_discount, v_total, p_customer, p_note, (select auth.uid()), v_location_id)
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
revoke execute on function public.pos_record_sale(uuid, jsonb, numeric, uuid, text, uuid) from public, anon;
grant execute on function public.pos_record_sale(uuid, jsonb, numeric, uuid, text, uuid) to authenticated;
