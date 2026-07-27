-- 0180: merchant-defined custom checkout fields (gift note, floor number,
-- preferred color, …). A store defines fields; the customer answers them at
-- checkout; the answers ride along as a jsonb blob on the order. NON-financial —
-- nothing here touches price, stock, or coupon logic.
--
-- Rollout safety: the order RPCs are REPLACED by a single 14-param version
-- (p_custom_fields defaulted), and the older 9-/13-arg overloads are DROPPED at
-- the end. Collapsing to one overload avoids the "function is not unique" error
-- that named-arg calls hit when two overloads both match via defaults — while
-- the defaulted param means the currently-deployed 13-key frontend still
-- resolves to the single remaining function during the deploy window.

alter table public.orders
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create table if not exists public.store_checkout_fields (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null,
  label_en text,
  field_type text not null default 'text'
    check (field_type in ('text', 'textarea', 'select')),
  options jsonb not null default '[]'::jsonb,   -- for select
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists store_checkout_fields_store
  on public.store_checkout_fields (store_id) where active;

alter table public.store_checkout_fields enable row level security;

drop policy if exists checkout_fields_read on public.store_checkout_fields;
create policy checkout_fields_read on public.store_checkout_fields
  for select using (
    active or public.can_manage_store(store_id)
  );
drop policy if exists checkout_fields_write on public.store_checkout_fields;
create policy checkout_fields_write on public.store_checkout_fields
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- ── 14-arg place_customer_order (adds p_custom_fields) ───────────────────────
create or replace function public.place_customer_order(
  p_store_id uuid, p_phone text, p_address text, p_fulfillment text,
  p_note text, p_coupon text, p_items jsonb,
  p_location_id uuid default null, p_redeem_points integer default 0,
  p_zone_id uuid default null, p_change_for numeric default null,
  p_delivery_instructions text default null, p_idempotency_key text default null,
  p_custom_fields jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $function$
declare
  v_uid uuid := auth.uid();
  v_item jsonb; v_product record; v_variant record; v_qty int;
  v_unit numeric(12,2); v_addons numeric(12,2); v_addon_names text; v_name text;
  v_subtotal numeric(12,2) := 0; v_discount numeric(12,2) := 0; v_coupon record;
  v_valid_items jsonb := '[]'::jsonb; v_order_id uuid; v_customer_name text;
  v_location_id uuid; v_redeem_enabled boolean; v_ppu int; v_balance int;
  v_points_used int := 0; v_points_discount numeric(12,2) := 0;
  v_cap numeric(12,2); v_net numeric(12,2); v_zone_id uuid; v_fee numeric(12,2) := 0;
  v_cf jsonb := case when jsonb_typeof(p_custom_fields) = 'object'
                     then p_custom_fields else '{}'::jsonb end;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_idempotency_key is not null then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and customer_id = v_uid;
    if found then return v_order_id; end if;
  end if;
  if not exists (select 1 from public.stores where id = p_store_id and status = 'active' and deleted_at is null) then
    raise exception 'store_unavailable';
  end if;
  if p_fulfillment not in ('delivery', 'pickup') then raise exception 'bad_fulfillment'; end if;
  if p_fulfillment = 'delivery' and (p_address is null or length(trim(p_address)) = 0) then
    raise exception 'address_required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many_items'; end if;

  if p_location_id is not null then
    if not exists (select 1 from public.store_locations where id = p_location_id and store_id = p_store_id and is_active = true) then
      raise exception 'bad_location';
    end if;
    v_location_id := p_location_id;
  else
    select id into v_location_id from public.store_locations
    where store_id = p_store_id and is_primary = true and is_active = true limit 1;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_qty > 1000 then raise exception 'bad_quantity'; end if;
    select id, name, price, discount_price, flash_price, flash_start, flash_end into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and store_id = p_store_id
      and status = 'active' and is_available = true and deleted_at is null;
    if not found then raise exception 'product_unavailable'; end if;
    if v_product.flash_price is not null and v_product.flash_start is not null and v_product.flash_end is not null
       and now() >= v_product.flash_start and now() < v_product.flash_end then
      v_unit := v_product.flash_price;
    else
      v_unit := coalesce(v_product.discount_price, v_product.price);
    end if;
    v_name := v_product.name;
    if v_item->>'variant_id' is not null then
      select id, label, price, is_available into v_variant
      from public.product_variants where id = (v_item->>'variant_id')::uuid and product_id = v_product.id;
      if not found or not v_variant.is_available then raise exception 'variant_unavailable'; end if;
      v_unit := coalesce(v_variant.price, v_unit);
      v_name := v_name || ' - ' || v_variant.label;
    end if;
    v_addons := 0; v_addon_names := null;
    if v_item ? 'addon_ids' and jsonb_typeof(v_item->'addon_ids') = 'array' and jsonb_array_length(v_item->'addon_ids') > 0 then
      select coalesce(sum(o.price), 0), string_agg(o.name, ', ') into v_addons, v_addon_names
      from public.product_options o
      where o.product_id = v_product.id
        and o.id in (select (a.value #>> '{}')::uuid from jsonb_array_elements(v_item->'addon_ids') a);
      if v_addon_names is null then raise exception 'addon_unavailable'; end if;
      v_name := v_name || ' (+ ' || v_addon_names || ')';
    end if;
    v_unit := v_unit + v_addons;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_valid_items := v_valid_items || jsonb_build_object(
      'product_id', v_product.id, 'variant_id', v_item->>'variant_id',
      'name', v_name, 'unit_price', v_unit, 'quantity', v_qty);
  end loop;

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon from public.validate_coupon(p_store_id, upper(trim(p_coupon)), v_subtotal);
    if v_coupon.valid then v_discount := coalesce(v_coupon.discount, 0); end if;
  end if;

  if coalesce(p_redeem_points, 0) > 0 then
    select loyalty_redemption_enabled, loyalty_points_per_unit into v_redeem_enabled, v_ppu
      from public.stores where id = p_store_id;
    if not coalesce(v_redeem_enabled, false) then raise exception 'redemption_disabled'; end if;
    perform pg_advisory_xact_lock(hashtext('loyalty_redeem:' || v_uid::text || ':' || p_store_id::text));
    select coalesce(sum(delta), 0)::int into v_balance
      from public.loyalty_ledger where user_id = v_uid and store_id = p_store_id;
    v_points_used := least(p_redeem_points, greatest(v_balance, 0));
    if v_points_used > 0 then
      v_points_discount := round(v_points_used::numeric / v_ppu, 2);
      v_cap := greatest(0, v_subtotal - v_discount);
      if v_points_discount > v_cap then
        v_points_discount := v_cap;
        v_points_used := least(round(v_points_discount * v_ppu)::int, v_balance);
      end if;
    end if;
    if v_points_discount <= 0 then v_points_used := 0; v_points_discount := 0; end if;
  end if;

  v_net := greatest(0, v_subtotal - v_discount - v_points_discount);
  select r.zone_id, r.fee into v_zone_id, v_fee
    from public.resolve_delivery_fee(p_store_id, p_zone_id, p_fulfillment, v_net) r;

  select full_name into v_customer_name from public.profiles where id = v_uid;

  begin
    insert into public.orders (
      store_id, customer_id, customer_name, phone, address, fulfillment,
      customer_note, subtotal, discount, delivery_fee, total, coupon_code,
      status, location_id, delivery_zone_id, change_for,
      delivery_instructions, idempotency_key, custom_fields
    ) values (
      p_store_id, v_uid, v_customer_name, nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_address, '')), ''), p_fulfillment::public.fulfillment_type,
      nullif(trim(coalesce(p_note, '')), ''), v_subtotal, v_discount + v_points_discount,
      coalesce(v_fee, 0), v_net + coalesce(v_fee, 0),
      case when v_discount > 0 then upper(trim(p_coupon)) else null end,
      'pending', v_location_id, v_zone_id,
      case when p_change_for is not null and p_change_for > 0 then p_change_for end,
      nullif(trim(coalesce(p_delivery_instructions, '')), ''), p_idempotency_key, v_cf
    ) returning id into v_order_id;
  exception when unique_violation then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and customer_id = v_uid;
    return v_order_id;
  end;

  insert into public.order_items (order_id, product_id, variant_id, name, unit_price, quantity)
  select v_order_id, (e->>'product_id')::uuid, (e->>'variant_id')::uuid,
         e->>'name', (e->>'unit_price')::numeric, (e->>'quantity')::int
  from jsonb_array_elements(v_valid_items) e;

  if v_points_used > 0 then
    insert into public.loyalty_ledger (user_id, delta, reason, store_id, order_id)
    values (v_uid, -v_points_used, 'redeem', p_store_id, v_order_id);
  end if;

  return v_order_id;
end;
$function$;

-- ── 14-arg place_guest_order (adds p_custom_fields) ──────────────────────────
create or replace function public.place_guest_order(
  p_store_id uuid, p_customer_name text, p_phone text, p_address text,
  p_fulfillment text, p_note text, p_coupon text, p_items jsonb,
  p_location_id uuid default null, p_zone_id uuid default null,
  p_change_for numeric default null, p_delivery_instructions text default null,
  p_idempotency_key text default null, p_custom_fields jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $function$
declare
  v_item jsonb; v_product record; v_qty int; v_unit numeric(12,2);
  v_subtotal numeric(12,2) := 0; v_discount numeric(12,2) := 0; v_coupon record;
  v_valid_items jsonb := '[]'::jsonb; v_order_id uuid; v_location_id uuid;
  v_net numeric(12,2); v_zone_id uuid; v_fee numeric(12,2) := 0;
  v_cf jsonb := case when jsonb_typeof(p_custom_fields) = 'object'
                     then p_custom_fields else '{}'::jsonb end;
begin
  if p_idempotency_key is not null then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and store_id = p_store_id;
    if found then return v_order_id; end if;
  end if;
  if not exists (select 1 from public.stores where id = p_store_id and status = 'active' and deleted_at is null) then
    raise exception 'store_unavailable';
  end if;
  if p_phone is null or length(trim(p_phone)) < 4 then raise exception 'phone_required'; end if;
  if p_fulfillment not in ('delivery', 'pickup') then raise exception 'bad_fulfillment'; end if;
  if p_fulfillment = 'delivery' and (p_address is null or length(trim(p_address)) = 0) then
    raise exception 'address_required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many_items'; end if;

  if p_location_id is not null then
    if not exists (select 1 from public.store_locations where id = p_location_id and store_id = p_store_id and is_active = true) then
      raise exception 'bad_location';
    end if;
    v_location_id := p_location_id;
  else
    select id into v_location_id from public.store_locations
    where store_id = p_store_id and is_primary = true and is_active = true limit 1;
  end if;

  if (select count(*) from public.orders
      where store_id = p_store_id and customer_id is null
        and phone = trim(p_phone) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_qty > 1000 then raise exception 'bad_quantity'; end if;
    select id, name, price, discount_price, flash_price, flash_start, flash_end into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and store_id = p_store_id
      and status = 'active' and is_available = true and deleted_at is null;
    if not found then raise exception 'product_unavailable'; end if;
    if v_product.flash_price is not null and v_product.flash_start is not null and v_product.flash_end is not null
       and now() >= v_product.flash_start and now() < v_product.flash_end then
      v_unit := v_product.flash_price;
    else
      v_unit := coalesce(v_product.discount_price, v_product.price);
    end if;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_valid_items := v_valid_items || jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name, 'unit_price', v_unit, 'quantity', v_qty);
  end loop;

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon from public.validate_coupon(p_store_id, upper(trim(p_coupon)), v_subtotal);
    if v_coupon.valid then v_discount := coalesce(v_coupon.discount, 0); end if;
  end if;

  v_net := greatest(0, v_subtotal - v_discount);
  select r.zone_id, r.fee into v_zone_id, v_fee
    from public.resolve_delivery_fee(p_store_id, p_zone_id, p_fulfillment, v_net) r;

  begin
    insert into public.orders (
      store_id, customer_id, customer_name, phone, address, fulfillment,
      customer_note, subtotal, discount, delivery_fee, total, coupon_code,
      status, location_id, delivery_zone_id, change_for,
      delivery_instructions, idempotency_key, custom_fields
    ) values (
      p_store_id, null, nullif(trim(p_customer_name), ''), trim(p_phone),
      nullif(trim(p_address), ''), p_fulfillment::public.fulfillment_type,
      nullif(trim(p_note), ''), v_subtotal, v_discount,
      coalesce(v_fee, 0), v_net + coalesce(v_fee, 0),
      case when v_discount > 0 then upper(trim(p_coupon)) else null end,
      'pending', v_location_id, v_zone_id,
      case when p_change_for is not null and p_change_for > 0 then p_change_for end,
      nullif(trim(coalesce(p_delivery_instructions, '')), ''), p_idempotency_key, v_cf
    ) returning id into v_order_id;
  exception when unique_violation then
    select id into v_order_id from public.orders
     where idempotency_key = p_idempotency_key and store_id = p_store_id;
    return v_order_id;
  end;

  insert into public.order_items (order_id, product_id, name, unit_price, quantity)
  select v_order_id, (e->>'product_id')::uuid, e->>'name',
         (e->>'unit_price')::numeric, (e->>'quantity')::int
  from jsonb_array_elements(v_valid_items) e;

  return v_order_id;
end;
$function$;

revoke execute on function public.place_customer_order(uuid, text, text, text, text, text, jsonb, uuid, integer, uuid, numeric, text, text, jsonb) from public, anon;
grant execute on function public.place_customer_order(uuid, text, text, text, text, text, jsonb, uuid, integer, uuid, numeric, text, text, jsonb) to authenticated;
grant execute on function public.place_guest_order(uuid, text, text, text, text, text, text, jsonb, uuid, uuid, numeric, text, text, jsonb) to anon, authenticated;

-- Drop the superseded overloads so named-arg resolution is unambiguous.
drop function if exists public.place_customer_order(uuid, text, text, text, text, text, jsonb, uuid, integer);
drop function if exists public.place_customer_order(uuid, text, text, text, text, text, jsonb, uuid, integer, uuid, numeric, text, text);
drop function if exists public.place_guest_order(uuid, text, text, text, text, text, text, jsonb, uuid);
drop function if exists public.place_guest_order(uuid, text, text, text, text, text, text, jsonb, uuid, uuid, numeric, text, text);
