-- 0229: the delivery fee and the store minimum stop being optional.
--
-- Two checkout surfaces priced the same basket differently. The store cart
-- passes p_zone_id and blocks the button under stores.min_order; the product
-- page passes neither, because it has no zone picker and no cart total to check
-- against. Nothing on the server minded:
--
--   * resolve_delivery_fee returned (null, 0) whenever p_zone_id was null, so
--     the fee was zero and the zone's own minimum was never reached.
--   * stores.min_order was enforced only by a disabled button in the cart UI.
--
-- So the same item ordered from its own page cost the customer less and the
-- merchant a delivery run — and any crafted request could do the same from
-- anywhere. Fixing the client would have left the hole open for the next
-- client, so both rules move to where they cannot be skipped.
--
-- resolve_delivery_fee now refuses when the store has active zones, the order
-- is a delivery, and no zone was named. A store with no zones is unaffected —
-- which is every store today.
--
-- The minimum is checked against v_subtotal rather than the post-discount net,
-- matching what the cart UI compares and what a merchant means by "minimum
-- order": the value of the goods, not what was paid after a coupon.
--
-- Verified on production inside rolled-back transactions:
--   store with a minimum, order under it        → below_store_minimum
--   store with zones, delivery, no zone passed  → zone_required
--   store with neither (every store today)      → still places normally

create or replace function public.resolve_delivery_fee(
  p_store_id uuid, p_zone_id uuid, p_fulfillment text, p_net_subtotal numeric)
returns table(zone_id uuid, fee numeric)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_zone record;
begin
  if p_fulfillment <> 'delivery' then
    return query select null::uuid, 0::numeric;
    return;
  end if;

  if p_zone_id is null then
    if exists (select 1 from public.store_delivery_zones z
                where z.store_id = p_store_id and z.active) then
      raise exception 'zone_required';
    end if;
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
end $function$;

do $do$
declare d text; d2 text; f text;
begin
  foreach f in array array['place_customer_order', 'place_guest_order'] loop
    select pg_get_functiondef(oid) into d from pg_proc
     where pronamespace='public'::regnamespace and proname=f;
    d2 := replace(d,
$q$  select r.zone_id, r.fee into v_zone_id, v_fee$q$,
$q$  if exists (select 1 from public.stores s
              where s.id = p_store_id and s.min_order is not null
                and v_subtotal < s.min_order) then
    raise exception 'below_store_minimum';
  end if;
  select r.zone_id, r.fee into v_zone_id, v_fee$q$);
    if d2 = d then raise exception 'minimum anchor did not match in %', f; end if;
    execute d2;
  end loop;
end
$do$;
