-- 0231: dispatching a courier stops re-pricing the customer's order.
--
-- request_delivery ended with:
--
--   update public.orders
--   set delivery_fee = v_fee,
--       total = coalesce(subtotal,0) - coalesce(discount,0) + v_fee
--
-- v_fee is what the COURIER charges the STORE. orders.delivery_fee is what the
-- CUSTOMER agreed to pay. Assigning one to the other re-priced an order that
-- had already been placed and accepted — upward whenever the courier cost more
-- than the store's own delivery charge, and all the way down to zero when the
-- store had no price on file for that company, wiping a fee the customer had
-- already been charged.
--
-- It also fought the checkout: total was recomputed without tax_amount and
-- without the loyalty discount that place_customer_order folds into `discount`,
-- so a dispatch could quietly undo a redemption.
--
-- The courier's fee already lands on the delivery_requests row inserted a few
-- lines above, which is where store_delivery_report reads it. Nothing needed to
-- replace the update — it only needed to stop.
--
-- Verified on production inside a rolled-back transaction. Order of 100 with a
-- 2.00 delivery fee, dispatched to a courier priced at 9.00:
--   orders.total          102.00 → 102.00   (was becoming 109.00)
--   orders.delivery_fee     2.00 →   2.00   (was becoming 9.00)
--   delivery_requests.fee            9.00   (the merchant's cost, recorded)

do $do$
declare d text; d2 text; nl text; anchor text;
begin
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace='public'::regnamespace and proname='request_delivery';
  if d is null then raise exception 'request_delivery not found'; end if;

  -- The stored body uses CRLF; build the anchor for whichever it actually is.
  nl := case when position(chr(13) || chr(10) in d) > 0
             then chr(13) || chr(10) else chr(10) end;

  anchor :=
    '  update public.orders' || nl ||
    '  set delivery_fee = v_fee,' || nl ||
    '      total = coalesce(subtotal, 0) - coalesce(discount, 0) + v_fee' || nl ||
    '  where id = p_order_id;';

  d2 := replace(d, anchor,
    '  -- The order total is deliberately left alone. v_fee is what the courier' || nl ||
    '  -- charges the STORE; orders.delivery_fee is what the CUSTOMER agreed to' || nl ||
    '  -- pay. Overwriting one with the other silently re-priced a placed order:' || nl ||
    '  -- upward when the courier cost more, and down to zero when the store had' || nl ||
    '  -- no price on file for that company, wiping a fee the customer had already' || nl ||
    '  -- been charged. The courier fee lives on the delivery_requests row above,' || nl ||
    '  -- which is where store_delivery_report reads it from.');

  if d2 = d then raise exception 'orders update block did not match'; end if;
  execute d2;
end
$do$;
