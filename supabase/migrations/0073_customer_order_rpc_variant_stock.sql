-- Order-pricing integrity for signed-in customers + variant stock enforcement.
--
-- Problem 1: the logged-in checkout inserted client-computed prices straight
-- into orders/order_items (tamperable via devtools). Guests were already safe
-- via place_guest_order. Fix: place_customer_order — same server-side
-- recomputation, plus variant/add-on aware pricing for the product page.
--
-- Problem 2: variant stock was never enforced (the stock guard only knew
-- products.stock). order_items now records variant_id and the guard
-- decrements/restores per-variant stock when present.

-- ---- Variant stock ----------------------------------------------------------

alter table public.order_items
  add column if not exists variant_id uuid
    references public.product_variants (id) on delete set null;

create or replace function public.decrement_product_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.variant_id is not null then
    -- Variant chosen: the variant's stock is the source of truth.
    update public.product_variants
       set stock = stock - new.quantity
     where id = new.variant_id
       and (stock is null or stock >= new.quantity);
    if not found then
      raise exception 'insufficient_stock' using errcode = '23514';
    end if;
  else
    update public.products
       set stock = stock - new.quantity
     where id = new.product_id and (stock is null or stock >= new.quantity);
    if not found then
      raise exception 'insufficient_stock' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create or replace function public.restore_stock_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelled','rejected')
     and old.status not in ('cancelled','rejected') then
    update public.products p
       set stock = p.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.variant_id is null
       and p.id = oi.product_id and p.stock is not null;
    update public.product_variants v
       set stock = v.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.variant_id = v.id
       and v.stock is not null;
  end if;
  return new;
end $$;

-- ---- Authenticated checkout RPC ---------------------------------------------
-- Mirrors place_guest_order, plus variant + add-on aware server-side pricing.
-- p_items: [{product_id, quantity, variant_id?, addon_ids?: uuid[]}, …]

create or replace function public.place_customer_order(
  p_store_id uuid,
  p_phone text,
  p_address text,
  p_fulfillment text,
  p_note text,
  p_coupon text,
  p_items jsonb
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
    customer_note, subtotal, discount, total, coupon_code, status
  ) values (
    p_store_id, v_uid, v_customer_name, nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    p_fulfillment::public.fulfillment_type,
    nullif(trim(coalesce(p_note, '')), ''), v_subtotal, v_discount,
    greatest(0, v_subtotal - v_discount),
    case when v_discount > 0 then upper(trim(p_coupon)) else null end,
    'pending'
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
  uuid, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.place_customer_order(
  uuid, text, text, text, text, text, jsonb
) to authenticated;