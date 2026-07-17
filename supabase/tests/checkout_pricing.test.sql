-- ============================================================================
-- Checkout pricing regression guard
-- ============================================================================
-- WHY THIS EXISTS
--   Migration 0085 (branch stamping) recreated place_guest_order /
--   place_customer_order from the pre-flash 0081/0073 bodies and SILENTLY
--   dropped the flash-pricing rule that 0058 had added -- so products inside a
--   live flash window were charged the higher discount/base price at checkout
--   (a real money bug, fixed in 0103). A pricing test would have caught it.
--
-- WHAT IT ASSERTS (the checkout pricing contract, for BOTH order RPCs)
--   (a) flash_price wins while now() is inside [flash_start, flash_end)
--   (b) discount_price applies with no flash, or when the flash window is closed
--   (c) base price applies when there is neither flash nor discount
--   (d) a variant price replaces the base price (customer order only)
--   (e) a coupon reduces the order total
--
-- HOW IT RUNS / ROLLS BACK
--   The whole test is ONE `do $$ ... $$` block. It creates its own throwaway
--   store owner, customer, store, products, variant and coupon, calls the RPCs,
--   and reads the values back. It ALWAYS ends by RAISING an exception -- either
--   the first failing assertion, or a final "TEST PASSED" sentinel -- and a
--   raised exception aborts the transaction, so EVERY row inserted here is
--   rolled back. Nothing is ever committed to the database.
--
--   Interpreting the result (the run "errors" on purpose):
--     * message contains 'CHECKOUT PRICING TEST PASSED'  -> all checks passed
--     * message contains 'CHECKOUT PRICING TEST FAILED'  -> that check regressed
--
--   Run it from the Supabase SQL editor, or:
--     supabase db execute --file supabase/tests/checkout_pricing.test.sql
-- ============================================================================

do $$
declare
  v_owner    uuid;
  v_customer uuid;
  v_store    uuid;
  v_prod     uuid;
  v_variant  uuid;
  v_order    uuid;
  v_unit     numeric(12, 2);
  v_total    numeric(12, 2);
begin
  -- ---- Fixtures ------------------------------------------------------------
  -- profiles.id -> auth.users(id), so each principal needs an auth.users row.
  v_owner := gen_random_uuid();
  insert into auth.users (id) values (v_owner);
  insert into public.profiles (id, full_name)
    values (v_owner, 'Pricing Test Owner') on conflict (id) do nothing;

  v_customer := gen_random_uuid();
  insert into auth.users (id) values (v_customer);
  insert into public.profiles (id, full_name)
    values (v_customer, 'Pricing Test Customer') on conflict (id) do nothing;

  -- Pro plan so the free 3-product limit (0079) doesn't cap the fixtures below.
  insert into public.stores (owner_id, name, status, plan)
    values (v_owner, 'Pricing Test Store', 'active', 'pro')
    returning id into v_store;

  -- 10%-off coupon (validate_coupon upper-cases the submitted code).
  insert into public.coupons (store_id, code, type, value)
    values (v_store, 'SAVE10', 'percent', 10);

  -- ========================================================================
  -- GUEST ORDER RPC  (place_guest_order)
  -- All products leave stock = NULL (untracked) so the oversell trigger is a
  -- no-op. fulfillment = 'pickup' so no address is required. Each guest case
  -- uses a distinct phone so the per-(store,phone) rate limit never trips.
  -- ========================================================================

  -- (a) GUEST flash wins inside the window.
  --     price 100, discount 80, flash 50, now() within [start, end) -> 50.00
  insert into public.products
    (store_id, name, price, discount_price, flash_price, flash_start, flash_end)
  values
    (v_store, 'G1 flash', 100, 80, 50, now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_prod;

  v_order := public.place_guest_order(
    v_store, 'Guest', '0100000001', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 50.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [G1 guest flash] inside a live flash window expected unit_price 50.00, got %',
      v_unit;
  end if;

  -- (b) GUEST discount applies when the flash window is CLOSED.
  --     price 100, discount 80, flash 50 but window is in the past -> 80.00
  insert into public.products
    (store_id, name, price, discount_price, flash_price, flash_start, flash_end)
  values
    (v_store, 'G2 expired flash', 100, 80, 50, now() - interval '2 hours', now() - interval '1 hour')
  returning id into v_prod;

  v_order := public.place_guest_order(
    v_store, 'Guest', '0100000002', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 80.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [G2 guest discount] with the flash window closed expected discount_price 80.00, got %',
      v_unit;
  end if;

  -- (c) GUEST base price when there is neither flash nor discount.
  --     price 100, no discount, no flash -> 100.00
  insert into public.products (store_id, name, price)
    values (v_store, 'G3 base', 100)
    returning id into v_prod;

  v_order := public.place_guest_order(
    v_store, 'Guest', '0100000003', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 100.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [G3 guest base] with no flash and no discount expected base price 100.00, got %',
      v_unit;
  end if;

  -- (e) GUEST coupon reduces the order total.
  --     price 100 x qty 2 = subtotal 200; SAVE10 (10%) -> discount 20; total 180.00
  insert into public.products (store_id, name, price)
    values (v_store, 'G4 coupon', 100)
    returning id into v_prod;

  v_order := public.place_guest_order(
    v_store, 'Guest', '0100000004', null, 'pickup', null, 'SAVE10',
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 2)));
  select total into v_total from public.orders where id = v_order;
  if v_total is distinct from 180.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [G4 guest coupon] subtotal 200 with a 10%% coupon expected total 180.00, got %',
      v_total;
  end if;

  -- ========================================================================
  -- CUSTOMER ORDER RPC  (place_customer_order)
  -- This RPC reads auth.uid(); fake a signed-in customer by setting the JWT
  -- claim that auth.uid() derives 'sub' from (local to this transaction).
  -- ========================================================================
  perform set_config('request.jwt.claims',
                     jsonb_build_object('sub', v_customer::text)::text, true);

  -- (a) CUSTOMER flash wins inside the window -> 50.00
  insert into public.products
    (store_id, name, price, discount_price, flash_price, flash_start, flash_end)
  values
    (v_store, 'C1 flash', 100, 80, 50, now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_prod;

  v_order := public.place_customer_order(
    v_store, '0100000009', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 50.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [C1 customer flash] inside a live flash window expected unit_price 50.00, got %',
      v_unit;
  end if;

  -- (b) CUSTOMER discount applies with no flash -> 80.00
  insert into public.products (store_id, name, price, discount_price)
    values (v_store, 'C2 discount', 100, 80)
    returning id into v_prod;

  v_order := public.place_customer_order(
    v_store, '0100000009', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 80.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [C2 customer discount] with no flash expected discount_price 80.00, got %',
      v_unit;
  end if;

  -- (c) CUSTOMER base price when there is neither flash nor discount -> 100.00
  insert into public.products (store_id, name, price)
    values (v_store, 'C3 base', 100)
    returning id into v_prod;

  v_order := public.place_customer_order(
    v_store, '0100000009', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 100.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [C3 customer base] with no flash and no discount expected base price 100.00, got %',
      v_unit;
  end if;

  -- (d) CUSTOMER variant price REPLACES the base price.
  --     product base is 80 (discounted); variant price 120 must override -> 120.00
  insert into public.products (store_id, name, price, discount_price)
    values (v_store, 'C4 variant', 100, 80)
    returning id into v_prod;
  insert into public.product_variants (product_id, label, price, is_available)
    values (v_prod, 'Large', 120, true)
    returning id into v_variant;

  v_order := public.place_customer_order(
    v_store, '0100000009', null, 'pickup', null, null,
    jsonb_build_array(jsonb_build_object(
      'product_id', v_prod, 'variant_id', v_variant, 'quantity', 1)));
  select unit_price into v_unit from public.order_items where order_id = v_order limit 1;
  if v_unit is distinct from 120.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [C4 customer variant] the variant price should replace the base; expected 120.00, got %',
      v_unit;
  end if;

  -- (e) CUSTOMER coupon reduces the order total.
  --     price 100 x qty 2 = subtotal 200; SAVE10 (10%) -> discount 20; total 180.00
  insert into public.products (store_id, name, price)
    values (v_store, 'C5 coupon', 100)
    returning id into v_prod;

  v_order := public.place_customer_order(
    v_store, '0100000009', null, 'pickup', null, 'SAVE10',
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 2)));
  select total into v_total from public.orders where id = v_order;
  if v_total is distinct from 180.00 then
    raise exception
      'CHECKOUT PRICING TEST FAILED: [C5 customer coupon] subtotal 200 with a 10%% coupon expected total 180.00, got %',
      v_total;
  end if;

  -- ---- All good ------------------------------------------------------------
  -- Raising here rolls the whole transaction back (nothing above is committed)
  -- while signalling success. Treat this specific message as a PASS.
  raise exception
    'CHECKOUT PRICING TEST PASSED: all 9 checks passed (guest a/b/c/e + customer a/b/c/d/e); transaction rolled back, no data written.';
end;
$$;
