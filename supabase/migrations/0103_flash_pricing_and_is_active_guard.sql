-- Two independent fixes found in the full QA pass.
--
-- (1) FLASH OVERCHARGE (critical, money bug).
--     0058 taught the checkout RPCs the flash rule, but 0085 (branch stamping)
--     recreated place_guest_order / place_customer_order from the pre-flash 0081/
--     0073 bodies and silently dropped it. Since 0085 both RPCs charge
--     coalesce(discount_price, price) and never read flash_price -- so a product
--     inside its live flash window (advertised at flash_price on /flash and the
--     storefront) is charged the higher discount/base price at checkout.
--     This restores the flash rule on top of the current (branch-aware) bodies;
--     everything else is byte-identical to 0085.
--
-- (2) SELF-REACTIVATION (high, authz hole).
--     profiles_update (0054) lets a user update their own row, and
--     prevent_role_change (0004) only reverts `role` changes -- nothing guards
--     `is_active`. A suspended user can still authenticate and run
--     `update profiles set is_active = true where id = auth.uid()` to un-suspend
--     themselves, defeating admin suspension. We extend the same trigger to also
--     revert is_active changes made by anyone who is not a super_admin.

-- ---- (1a) Guest checkout: flash rule restored --------------------------------

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
    -- Flash price wins while the window is open; else discount, else price.
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

-- ---- (1b) Authenticated checkout: flash rule restored ------------------------

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

    -- Flash price wins while the window is open; else discount, else price.
    if v_product.flash_price is not null
       and v_product.flash_start is not null and v_product.flash_end is not null
       and now() >= v_product.flash_start and now() < v_product.flash_end then
      v_unit := v_product.flash_price;
    else
      v_unit := coalesce(v_product.discount_price, v_product.price);
    end if;
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

-- ---- (2) is_active self-reactivation guard -----------------------------------
-- Same trigger that already reverts unauthorized role changes; now it also
-- reverts is_active changes made by anyone who is not a super_admin. Service/
-- backend calls (auth.uid() is null) keep full control for admin tooling.

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  v_is_admin := auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  );

  if new.role is distinct from old.role then
    if auth.uid() is not null and not v_is_admin then
      new.role := old.role;
    end if;
  end if;

  -- Only super_admins (or service/backend) may flip a suspension. A suspended
  -- user must not be able to reactivate their own account.
  if new.is_active is distinct from old.is_active then
    if auth.uid() is not null and not v_is_admin then
      new.is_active := old.is_active;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_role_change() from public, anon, authenticated;
