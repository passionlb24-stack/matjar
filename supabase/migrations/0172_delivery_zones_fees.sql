-- Smart delivery, phase 1 (orders wave). The #1 customer question — "قديه
-- التوصيلة وأيمتى بتوصل؟" — had no answer: couriers were informational and
-- orders.delivery_fee existed but was never set. This adds per-store delivery
-- ZONES (fee / zone minimum / free-over threshold / ETA range), charges the fee
-- server-side inside both order RPCs, and records the Lebanese-market fields
-- the checkout now collects: "أحتاج فكة لـ" (change_for) + delivery
-- instructions. Also adds order idempotency: flaky-connection double-taps of
-- "تأكيد الطلب" return the SAME order instead of creating duplicates.

create table if not exists public.store_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,                 -- "طرابلس - الميناء"
  name_en text,
  fee numeric(12, 2) not null default 0,
  min_order numeric(12, 2),           -- zone-specific minimum (null = store default)
  free_over numeric(12, 2),           -- free delivery at/above this subtotal
  eta_min_minutes int,
  eta_max_minutes int,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists store_delivery_zones_store_idx
  on public.store_delivery_zones (store_id) where active;

alter table public.store_delivery_zones enable row level security;

-- Everyone can read active zones (checkout needs them, logged-in or guest).
create policy "delivery_zones_select_public" on public.store_delivery_zones
  for select using (active or public.can_manage_store(store_id));
-- Store managers maintain their zones.
create policy "delivery_zones_manage" on public.store_delivery_zones
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

alter table public.orders
  add column if not exists delivery_zone_id uuid references public.store_delivery_zones(id) on delete set null;
alter table public.orders
  add column if not exists change_for numeric(12, 2);
alter table public.orders
  add column if not exists delivery_instructions text;
alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_idx
  on public.orders (idempotency_key) where idempotency_key is not null;

-- Shared zone/fee resolution used by both order RPCs. Validates the zone
-- belongs to the store and is active, applies the free-over rule, and enforces
-- the zone minimum. Soft when no zone is passed (older clients mid-deploy).
create or replace function public.resolve_delivery_fee(
  p_store_id uuid,
  p_zone_id uuid,
  p_fulfillment text,
  p_net_subtotal numeric
) returns table (zone_id uuid, fee numeric)
language plpgsql security definer set search_path = '' as $$
declare v_zone record;
begin
  if p_fulfillment <> 'delivery' or p_zone_id is null then
    return query select null::uuid, 0::numeric;
    return;
  end if;
  select * into v_zone from public.store_delivery_zones z
   where z.id = p_zone_id and z.store_id = p_store_id and z.active;
  if not found then
    raise exception 'bad_zone';
  end if;
  if v_zone.min_order is not null and p_net_subtotal < v_zone.min_order then
    raise exception 'below_zone_minimum';
  end if;
  if v_zone.free_over is not null and p_net_subtotal >= v_zone.free_over then
    return query select v_zone.id, 0::numeric;
  else
    return query select v_zone.id, v_zone.fee;
  end if;
end $$;
revoke execute on function public.resolve_delivery_fee(uuid, uuid, text, numeric) from public, anon, authenticated;

-- ===== place_customer_order v2: + zone fee, change_for, instructions, idempotency =====
create or replace function public.place_customer_order(
  p_store_id uuid, p_phone text, p_address text, p_fulfillment text,
  p_note text, p_coupon text, p_items jsonb,
  p_location_id uuid default null, p_redeem_points integer default 0,
  p_zone_id uuid default null, p_change_for numeric default null,
  p_delivery_instructions text default null, p_idempotency_key text default null
) returns uuid
language plpgsql security definer set search_path to '' as $function$
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
  v_redeem_enabled boolean;
  v_ppu int;
  v_balance int;
  v_points_used int := 0;
  v_points_discount numeric(12, 2) := 0;
  v_cap numeric(12, 2);
  v_net numeric(12, 2);
  v_zone_id uuid;
  v_fee numeric(12, 2) := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Idempotent retry: same key returns the same order (double-tap on weak 4G).
  if p_idempotency_key is not null then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and customer_id = v_uid;
    if found then return v_order_id; end if;
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

    select id, name, price, discount_price, flash_price, flash_start, flash_end
      into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and store_id = p_store_id
      and status = 'active'
      and is_available = true
      and deleted_at is null;
    if not found then
      raise exception 'product_unavailable';
    end if;

    if v_product.flash_price is not null
       and v_product.flash_start is not null and v_product.flash_end is not null
       and now() >= v_product.flash_start and now() < v_product.flash_end then
      v_unit := v_product.flash_price;
    else
      v_unit := coalesce(v_product.discount_price, v_product.price);
    end if;
    v_name := v_product.name;

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

  if coalesce(p_redeem_points, 0) > 0 then
    select loyalty_redemption_enabled, loyalty_points_per_unit
      into v_redeem_enabled, v_ppu
      from public.stores where id = p_store_id;
    if not coalesce(v_redeem_enabled, false) then
      raise exception 'redemption_disabled';
    end if;

    perform pg_advisory_xact_lock(
      hashtext('loyalty_redeem:' || v_uid::text || ':' || p_store_id::text)
    );

    select coalesce(sum(delta), 0)::int into v_balance
    from public.loyalty_ledger
    where user_id = v_uid and store_id = p_store_id;

    v_points_used := least(p_redeem_points, greatest(v_balance, 0));

    if v_points_used > 0 then
      v_points_discount := round(v_points_used::numeric / v_ppu, 2);
      v_cap := greatest(0, v_subtotal - v_discount);
      if v_points_discount > v_cap then
        v_points_discount := v_cap;
        v_points_used := least(round(v_points_discount * v_ppu)::int, v_balance);
      end if;
    end if;

    if v_points_discount <= 0 then
      v_points_used := 0;
      v_points_discount := 0;
    end if;
  end if;

  -- Delivery fee from the chosen zone (server-authoritative).
  v_net := greatest(0, v_subtotal - v_discount - v_points_discount);
  select r.zone_id, r.fee into v_zone_id, v_fee
    from public.resolve_delivery_fee(p_store_id, p_zone_id, p_fulfillment, v_net) r;

  select full_name into v_customer_name
  from public.profiles where id = v_uid;

  begin
    insert into public.orders (
      store_id, customer_id, customer_name, phone, address, fulfillment,
      customer_note, subtotal, discount, delivery_fee, total, coupon_code,
      status, location_id, delivery_zone_id, change_for,
      delivery_instructions, idempotency_key
    ) values (
      p_store_id, v_uid, v_customer_name, nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_address, '')), ''),
      p_fulfillment::public.fulfillment_type,
      nullif(trim(coalesce(p_note, '')), ''), v_subtotal,
      v_discount + v_points_discount,
      coalesce(v_fee, 0),
      v_net + coalesce(v_fee, 0),
      case when v_discount > 0 then upper(trim(p_coupon)) else null end,
      'pending', v_location_id, v_zone_id,
      case when p_change_for is not null and p_change_for > 0 then p_change_for end,
      nullif(trim(coalesce(p_delivery_instructions, '')), ''),
      p_idempotency_key
    ) returning id into v_order_id;
  exception when unique_violation then
    -- A concurrent double-tap raced past the early check; return the winner.
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and customer_id = v_uid;
    return v_order_id;
  end;

  insert into public.order_items (order_id, product_id, variant_id, name, unit_price, quantity)
  select v_order_id,
         (e->>'product_id')::uuid,
         (e->>'variant_id')::uuid,
         e->>'name',
         (e->>'unit_price')::numeric,
         (e->>'quantity')::int
  from jsonb_array_elements(v_valid_items) e;

  if v_points_used > 0 then
    insert into public.loyalty_ledger (user_id, delta, reason, store_id, order_id)
    values (v_uid, -v_points_used, 'redeem', p_store_id, v_order_id);
  end if;

  return v_order_id;
end;
$function$;

-- ===== place_guest_order v2: same additions on the guest path =====
create or replace function public.place_guest_order(
  p_store_id uuid, p_customer_name text, p_phone text, p_address text,
  p_fulfillment text, p_note text, p_coupon text, p_items jsonb,
  p_location_id uuid default null,
  p_zone_id uuid default null, p_change_for numeric default null,
  p_delivery_instructions text default null, p_idempotency_key text default null
) returns uuid
language plpgsql security definer set search_path to '' as $function$
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
  v_net numeric(12, 2);
  v_zone_id uuid;
  v_fee numeric(12, 2) := 0;
begin
  if p_idempotency_key is not null then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and store_id = p_store_id;
    if found then return v_order_id; end if;
  end if;

  if not exists (
    select 1 from public.stores
    where id = p_store_id and status = 'active' and deleted_at is null
  ) then
    raise exception 'store_unavailable';
  end if;

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

  if (
    select count(*) from public.orders
    where store_id = p_store_id
      and customer_id is null
      and phone = trim(p_phone)
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_qty > 1000 then
      raise exception 'bad_quantity';
    end if;
    select id, name, price, discount_price, flash_price, flash_start, flash_end
      into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and store_id = p_store_id
      and status = 'active'
      and is_available = true
      and deleted_at is null;
    if not found then
      raise exception 'product_unavailable';
    end if;
    if v_product.flash_price is not null
       and v_product.flash_start is not null and v_product.flash_end is not null
       and now() >= v_product.flash_start and now() < v_product.flash_end then
      v_unit := v_product.flash_price;
    else
      v_unit := coalesce(v_product.discount_price, v_product.price);
    end if;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_valid_items := v_valid_items || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
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

  v_net := greatest(0, v_subtotal - v_discount);
  select r.zone_id, r.fee into v_zone_id, v_fee
    from public.resolve_delivery_fee(p_store_id, p_zone_id, p_fulfillment, v_net) r;

  begin
    insert into public.orders (
      store_id, customer_id, customer_name, phone, address, fulfillment,
      customer_note, subtotal, discount, delivery_fee, total, coupon_code,
      status, location_id, delivery_zone_id, change_for,
      delivery_instructions, idempotency_key
    ) values (
      p_store_id, null, nullif(trim(p_customer_name), ''), trim(p_phone),
      nullif(trim(p_address), ''), p_fulfillment::public.fulfillment_type,
      nullif(trim(p_note), ''), v_subtotal, v_discount,
      coalesce(v_fee, 0),
      v_net + coalesce(v_fee, 0),
      case when v_discount > 0 then upper(trim(p_coupon)) else null end,
      'pending', v_location_id, v_zone_id,
      case when p_change_for is not null and p_change_for > 0 then p_change_for end,
      nullif(trim(coalesce(p_delivery_instructions, '')), ''),
      p_idempotency_key
    ) returning id into v_order_id;
  exception when unique_violation then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and store_id = p_store_id;
    return v_order_id;
  end;

  insert into public.order_items (order_id, product_id, name, unit_price, quantity)
  select v_order_id,
         (e->>'product_id')::uuid,
         e->>'name',
         (e->>'unit_price')::numeric,
         (e->>'quantity')::int
  from jsonb_array_elements(v_valid_items) e;

  return v_order_id;
end;
$function$;
