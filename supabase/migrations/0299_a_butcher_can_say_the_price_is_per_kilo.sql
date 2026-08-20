-- 0299: a butcher can say the price is per kilo.
--
-- MJ-010 says "no per-kg/unit pricing". Production says something sharper. This
-- is ملحمة البركة's whole catalogue, read off the live database:
--
--   مفرومة $7.50 · كفتة $7.50 · شقف $7.80 · شرحات $7.80 · مقانق $7.39
--   سجق $7.60 · شاورما لحمة $7.80 · شاورما دجاج $7.50 · صدر دجاج $7.00
--   3 كيلو فخاد $6.00 → $5.00
--
-- Those are per-kilo prices. $7.50 is a kilo of minced beef in Tripoli, not a
-- portion of one. The butcher has been typing kilo prices into a column the
-- platform reads as a price per piece, and it has held together only because he
-- and his customers both assume "1 = a kilo" without either of them saying it.
-- "3 كيلو فخاد" is the same workaround with its seams showing: the weight went
-- into the product NAME because there was nowhere else to put it.
--
-- So a butcher CAN price meat here. What he cannot do is say what the price is
-- per, and what a customer cannot do is order half a kilo.
--
-- ── What this migration is careful NOT to be ───────────────────────────────
--
-- `order_items.quantity` is `int not null` (0006). `place_customer_order` and
-- `place_guest_order` compute `v_subtotal := v_unit * v_qty` straight from
-- `products.price` (0194). All of that is deployed and none of it is touched
-- here. Re-typing `quantity` to numeric would not be an additive migration, it
-- would be a contract change with every deployed caller of both RPCs, the
-- invoice builder, the margin report and restore_stock_on_cancel.
--
-- So the invariant these columns are built around is:
--
--     products.price remains the price of ONE ORDERABLE UNIT, and
--     order_items.quantity remains an integer count of those units.
--
-- The three columns below only DESCRIBE what one unit is — a kilo, a half kilo,
-- 250 grams. No function reads them. No trigger reads them. They cannot change
-- a subtotal, because nothing that computes a subtotal can see them. A row with
-- sold_by null is indistinguishable from a row that existed before this ran,
-- which is every one of the 60-odd priced products in production today.
--
-- The price per kilo is DERIVED in the app (src/lib/unit-pricing.ts), never
-- stored. A stored copy would be a second answer to the question `price`
-- already answers, and that is exactly the defect the retired `duration`
-- attribute records in src/lib/attributes.ts.
--
-- ── For the butcher, concretely ────────────────────────────────────────────
--
-- He sets sold_by='weight', unit_measure='kg', unit_amount=1 and changes no
-- price at all. His cards go from "$7.50" to "$7.50 / كيلو". If he later wants
-- to sell half kilos he sets unit_amount=0.5 and halves the price; the merchant
-- form shows him the derived per-kilo figure while he types, precisely so that
-- step cannot silently double or halve what he charges.
--
-- ── Verified on production inside rolled-back transactions ─────────────────
--
-- No order was placed to test this, deliberately: an order on a live store
-- rings a real merchant's phone, and the notification path is not something a
-- ROLLBACK can take back. The stronger proof was available without one — that
-- no deployed function can SEE these columns:
--
--   * 26 functions reference public.products. Zero name sold_by, unit_measure
--     or unit_amount (pg_get_functiondef ILIKE over every function in public).
--   * none does `select * from public.products`, none declares a
--     `public.products%rowtype`, and no view or materialised view selects from
--     products — so no deployed consumer's row shape widens.
--   * the only function that INSERTs into products is import_products, with an
--     explicit column list, which a new nullable column cannot disturb.
--
-- Then the DDL itself, `set local role authenticated` as the butcher who owns
-- ملحمة البركة, writing through the same RLS policy the merchant form uses:
--
--     A owner sets per-kilo (weight/kg/1)      ACCEPTED (1 row)
--     B owner sets 250 g    (weight/g/250)     ACCEPTED (1 row)
--     C unit_amount = 0                        REFUSED
--     D weight measured in litres              REFUSED
--     E unit_measure without sold_by           REFUSED
--     F sold_by without unit_amount            REFUSED
--     G unit_amount alone                      REFUSED
--     H sold_by = 'piece'                      REFUSED
--     I revert to piece pricing                ACCEPTED
--     J price of مفرومة through all of it      $7.50, unmoved
--
-- E is the one that matters: on the first run of this probe it read WRONGLY
-- ACCEPTED, which is what produced the `is not null` guards above. The constraint
-- also validated against all 63 live products on ADD without a single failure,
-- and all 63 remained sold_by null.

alter table public.products add column if not exists sold_by text;
alter table public.products add column if not exists unit_measure text;
alter table public.products add column if not exists unit_amount numeric(12,3);

-- All-or-nothing. A row carrying a measure but no amount would let the app
-- derive a per-kilo price by dividing by null — or worse, by a default — and a
-- wrong number on a price tag is the one failure mode worth a constraint.
-- Weight is measured in kg/g and volume in l/ml; nothing sells lamb by the
-- litre.
--
-- The three explicit `is not null` tests on the second branch are load-bearing,
-- not belt-and-braces. Written the obvious way — `sold_by in ('weight','volume')
-- and ...` — a row with sold_by NULL but unit_measure 'kg' makes the first
-- branch FALSE and the second branch NULL, and `false or null` is NULL, which a
-- CHECK constraint ACCEPTS. That half-configured row got through on the first
-- run of the probe below; it is refused now because a branch that begins with
-- `sold_by is not null` evaluates to FALSE rather than NULL.
alter table public.products drop constraint if exists products_unit_pricing_check;
alter table public.products add constraint products_unit_pricing_check check (
  (sold_by is null and unit_measure is null and unit_amount is null)
  or (
    sold_by is not null
    and unit_measure is not null
    and unit_amount is not null
    and sold_by in ('weight', 'volume')
    and unit_amount > 0
    and (
      (sold_by = 'weight' and unit_measure in ('kg', 'g'))
      or (sold_by = 'volume' and unit_measure in ('l', 'ml'))
    )
  )
);

comment on column public.products.sold_by is
  'null = sold by the piece (the default, and every row before 0299). ''weight'' / ''volume'' = price is for a measured amount. Descriptive only: no SQL function reads this, and price/quantity arithmetic is unchanged.';
comment on column public.products.unit_measure is
  'The measure one priced unit is expressed in: kg/g for weight, l/ml for volume.';
comment on column public.products.unit_amount is
  'How much of unit_measure ONE unit of products.price buys. 1 with kg = the price is per kilo. 0.5 with kg = per half kilo. The per-kilo price is derived from these in the app, never stored.';
