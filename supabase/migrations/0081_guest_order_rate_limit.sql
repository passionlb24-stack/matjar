-- Security: throttle guest checkout. place_guest_order is granted to anon and
-- each call writes an order, decrements stock, bumps coupon usage and notifies
-- the owner — with no cap it's a denial-of-inventory / owner-spam / CRM-pollution
-- vector. We add a per-(store, phone) limit inside the SECURITY DEFINER RPC:
-- no legitimate shopper places 5+ separate guest orders to the SAME store within
-- an hour, so this has zero false positives for real use while blocking repeat
-- abuse from one identity. (Rotating-phone floods still need an edge/CAPTCHA
-- layer — tracked separately; this closes the cheap self-contained half.)
--
-- Only the rate-limit block is new; the rest is unchanged from 0053.
create or replace function public.place_guest_order(
  p_store_id uuid,
  p_customer_name text,
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
  v_item jsonb;
  v_product record;
  v_qty int;
  v_unit numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_coupon record;
  v_valid_items jsonb := '[]'::jsonb;
  v_order_id uuid;
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
    customer_note, subtotal, discount, total, coupon_code, status
  ) values (
    p_store_id, null, nullif(trim(p_customer_name), ''), trim(p_phone),
    nullif(trim(p_address), ''), p_fulfillment::public.fulfillment_type,
    nullif(trim(p_note), ''), v_subtotal, v_discount,
    greatest(0, v_subtotal - v_discount),
    case when v_discount > 0 then upper(trim(p_coupon)) else null end,
    'pending'
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

grant execute on function public.place_guest_order(
  uuid, text, text, text, text, text, text, jsonb
) to anon, authenticated;
