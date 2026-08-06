-- 0221: let a guest buy a variant.
--
-- place_customer_order has priced variants since 0073. place_guest_order never
-- learned how: no `variant_id` anywhere in its body, so the parameter was
-- silently ignored, the base price was charged, and `products.stock` was
-- decremented instead of `product_variants.stock`.
--
-- That combination is worse than either half. On the store used to verify this,
-- product "كلل" is priced 5.00 with a variant "احمر" at 7.00, and its stock
-- lives on the variant (4) while products.stock holds a separate 7. A guest
-- buying two of the red one paid 10.00 instead of 14.00, drew down a counter
-- that was not tracking the thing they bought, and left the merchant an order
-- line reading just "كلل" with no way to know which one to pack.
--
-- Guest checkout is a headline feature of the platform — "no account needed" —
-- so this was the default path for a first-time buyer, on the sectors most
-- likely to use variants at all: clothing and footwear.
--
-- Applied as four asserted substitutions against the live definition rather
-- than by re-declaring a 7KB function. Each replace() is followed by a check
-- that it actually changed something, so a drifted body fails loudly instead of
-- silently applying three patches out of four. The inserted block is character
-- for character the one place_customer_order already uses, so the two paths
-- cannot drift apart on how a variant is priced or named.
--
-- Verified on production inside a rolled-back transaction — a guest order for
-- two of the red variant:
--   line name            "كلل" → "كلل - احمر"
--   unit_price            5.00 → 7.00
--   order_items.variant_id null → set
--   product_variants.stock   4 → 2
--   products.stock           7 → 7 (correctly untouched)
--
-- The storefront grid still does not send variant_id — that is the client half
-- of this bug and is handled separately.

do $do$
declare d text; d2 text;
begin
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'place_guest_order';
  if d is null then raise exception 'place_guest_order not found'; end if;

  -- 1. declare the record the variant lookup reads into
  d2 := replace(d,
    $q$  v_item jsonb; v_product record; v_qty int;$q$,
    $q$  v_item jsonb; v_product record; v_variant record; v_qty int;$q$);
  if d2 = d then raise exception 'patch 1 (declare) did not match'; end if; d := d2;

  -- 2. price and name the variant, exactly as place_customer_order does
  d2 := replace(d,
$q$    v_name := v_product.name;
    v_addons := 0; v_addon_names := null;$q$,
$q$    v_name := v_product.name;
    if v_item->>'variant_id' is not null then
      select id, label, price, is_available into v_variant
      from public.product_variants where id = (v_item->>'variant_id')::uuid and product_id = v_product.id;
      if not found or not v_variant.is_available then raise exception 'variant_unavailable'; end if;
      v_unit := coalesce(v_variant.price, v_unit);
      v_name := v_name || ' - ' || v_variant.label;
    end if;
    v_addons := 0; v_addon_names := null;$q$);
  if d2 = d then raise exception 'patch 2 (pricing) did not match'; end if; d := d2;

  -- 3. carry variant_id through the validated item list
  d2 := replace(d,
    $q$      'product_id', v_product.id, 'name', v_name, 'unit_price', v_unit, 'quantity', v_qty,$q$,
    $q$      'product_id', v_product.id, 'variant_id', v_item->>'variant_id', 'name', v_name, 'unit_price', v_unit, 'quantity', v_qty,$q$);
  if d2 = d then raise exception 'patch 3 (valid_items) did not match'; end if; d := d2;

  -- 4. persist it, so the stock trigger decrements the variant and the merchant
  --    can see which one was ordered
  d2 := replace(d,
$q$  insert into public.order_items (order_id, product_id, name, unit_price, quantity, note)
  select v_order_id, (e->>'product_id')::uuid, e->>'name',$q$,
$q$  insert into public.order_items (order_id, product_id, variant_id, name, unit_price, quantity, note)
  select v_order_id, (e->>'product_id')::uuid, (e->>'variant_id')::uuid, e->>'name',$q$);
  if d2 = d then raise exception 'patch 4 (order_items) did not match'; end if; d := d2;

  execute d;
end
$do$;
