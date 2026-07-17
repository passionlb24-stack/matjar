-- Loyalty redemption AT CHECKOUT for logged-in customers.
--
-- 0107 gave merchants an opt-in (stores.loyalty_redemption_enabled) plus a rate
-- (stores.loyalty_points_per_unit = points that equal $1 of discount) and a
-- manager-driven redeem_loyalty_points RPC. This wires the SAME per-(user,store)
-- ledger into the customer's own checkout: place_customer_order gains a trailing
-- p_redeem_points param so a shopper can burn their points for a discount — but
-- only when the store has opted in.
--
-- Everything else in this function is byte-identical to 0103 (flash rule,
-- variants, add-ons, coupon, branch, rate/limits, security definer,
-- search_path=''). The ONLY additions are the redemption block (after the coupon
-- discount is computed, before the order total) and the negative 'redeem' ledger
-- row written against the new order.
--
-- HOW THE LOYALTY DISCOUNT IS STORED (chose the simpler consistent option):
--   The points discount is FOLDED INTO orders.discount alongside the coupon
--   discount — no new column. orders.total stays consistent as
--   greatest(0, subtotal - discount), where discount = coupon + points. coupon_code
--   is still stamped only when a coupon actually applied (based on the coupon
--   discount alone), so a points-only order carries a null coupon_code.
--
-- REDEMPTION MATH (all server-side, never trusting the client):
--   * gate: p_redeem_points > 0 requires stores.loyalty_redemption_enabled, else
--     raise 'redemption_disabled'.
--   * advisory xact lock per (customer, store) — identical key to
--     redeem_loyalty_points — so two concurrent checkouts can't double-spend.
--   * balance = coalesce(sum(delta),0) over loyalty_ledger for (customer, store).
--   * points_used = least(p_redeem_points, balance)  -- never more than they hold.
--   * points_discount = round(points_used / points_per_unit, 2), then CAPPED to
--     (subtotal - coupon_discount) so the running total can never go below 0.
--   * if the cap shrank the discount, RECOMPUTE the points consumed to match the
--     applied discount: points_used = least(round(points_discount * points_per_unit),
--     balance) — so we never burn points the customer got no value for.
--   * if the (possibly capped) discount rounds to <= 0, spend nothing.
--   * insert one negative 'redeem' loyalty_ledger row for exactly points_used,
--     linked to the new order_id, then subtract points_discount from the total.
--
-- The signature changes (adds a trailing int), so per the 0085/0103 pattern we
-- DROP the exact old 8-arg signature first, then recreate the 9-arg version and
-- restate its grants.

drop function if exists public.place_customer_order(
  uuid, text, text, text, text, text, jsonb, uuid
);

create function public.place_customer_order(
  p_store_id uuid,
  p_phone text,
  p_address text,
  p_fulfillment text,
  p_note text,
  p_coupon text,
  p_items jsonb,
  p_location_id uuid default null,
  p_redeem_points int default 0
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
  -- Loyalty redemption locals.
  v_redeem_enabled boolean;
  v_ppu int;
  v_balance int;
  v_points_used int := 0;
  v_points_discount numeric(12, 2) := 0;
  v_cap numeric(12, 2);
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

  -- Loyalty redemption: burn the customer's per-store points as a discount, but
  -- only when the store opted in (0107). Priced + capped entirely server-side.
  if coalesce(p_redeem_points, 0) > 0 then
    select loyalty_redemption_enabled, loyalty_points_per_unit
      into v_redeem_enabled, v_ppu
      from public.stores where id = p_store_id;
    if not coalesce(v_redeem_enabled, false) then
      raise exception 'redemption_disabled';
    end if;

    -- Serialize per (customer, store) exactly like redeem_loyalty_points so two
    -- concurrent checkouts can't spend the same points twice.
    perform pg_advisory_xact_lock(
      hashtext('loyalty_redeem:' || v_uid::text || ':' || p_store_id::text)
    );

    select coalesce(sum(delta), 0)::int into v_balance
    from public.loyalty_ledger
    where user_id = v_uid and store_id = p_store_id;

    -- Never spend more than they hold.
    v_points_used := least(p_redeem_points, greatest(v_balance, 0));

    if v_points_used > 0 then
      v_points_discount := round(v_points_used::numeric / v_ppu, 2);
      -- Cap so the running total can't go below zero.
      v_cap := greatest(0, v_subtotal - v_discount);
      if v_points_discount > v_cap then
        v_points_discount := v_cap;
        -- Applied discount shrank: consume only the points that discount is
        -- worth, so we never burn points the customer got no value for.
        v_points_used := least(round(v_points_discount * v_ppu)::int, v_balance);
      end if;
    end if;

    -- If the (capped) discount rounds to nothing, spend nothing.
    if v_points_discount <= 0 then
      v_points_used := 0;
      v_points_discount := 0;
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
    nullif(trim(coalesce(p_note, '')), ''), v_subtotal,
    v_discount + v_points_discount,
    greatest(0, v_subtotal - v_discount - v_points_discount),
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

  -- Record the redemption against this order: one negative 'redeem' row, the same
  -- per-(user, store) ledger the merchant CRM writes (0095/0107).
  if v_points_used > 0 then
    insert into public.loyalty_ledger (user_id, delta, reason, store_id, order_id)
    values (v_uid, -v_points_used, 'redeem', p_store_id, v_order_id);
  end if;

  return v_order_id;
end;
$$;

revoke execute on function public.place_customer_order(
  uuid, text, text, text, text, text, jsonb, uuid, int
) from public, anon;
grant execute on function public.place_customer_order(
  uuid, text, text, text, text, text, jsonb, uuid, int
) to authenticated;
