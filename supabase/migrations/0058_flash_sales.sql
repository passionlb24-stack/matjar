-- Flash sales: a merchant-controlled, time-boxed discount on a product.
-- flash_price applies only while now() is within [flash_start, flash_end);
-- outside the window the product falls back to discount_price, then price.
-- Merchants set this from the product edit form (self-serve, like Deal of the Day).

alter table public.products
  add column if not exists flash_price numeric(12, 2),
  add column if not exists flash_start timestamptz,
  add column if not exists flash_end   timestamptz;

-- Lookups for the active-flash listing page.
create index if not exists products_flash_idx
  on public.products (flash_end) where flash_price is not null;

-- The guest-order RPC recomputes prices server-side; teach it the flash rule so
-- guests are charged the flash price during the window (never trusting client).
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
    customer_note, subtotal, discount, total, coupon_code, status
  ) values (
    p_store_id, null, nullif(trim(p_customer_name), ''), trim(p_phone),
    nullif(trim(p_address), ''), p_fulfillment::public.fulfillment_type,
    nullif(trim(p_note), ''), v_subtotal, v_discount,
    greatest(0, v_subtotal - v_discount),
    case when v_discount > 0 then upper(trim(p_coupon)) else null end,
    'pending'
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
