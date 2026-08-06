-- 0222: let the spreadsheet importer carry cost of goods.
--
-- 0210 added products.cost and snapshots it onto every sale as cost_at_sale;
-- the product form got a field for it in the same change as this migration.
-- The importer is the other half: a merchant arriving with 200 rows is the one
-- moment they will fill a cost column, and typing it later product by product
-- is work nobody does.
--
-- Four asserted substitutions against the live definition, each single-line so
-- they are unaffected by the CRLF line endings in the stored body:
--   1. reject a non-numeric cost cell, mirroring the discount_price check
--   2. add cost to the INSERT column list
--   3. add the matching value in the same position
--   4. add it to the UPDATE pass, where an existing SKU is re-imported
--
-- Positioning matters in 2 and 3 and is why they are separate patches rather
-- than one: the value goes between discount_price and stock because that is
-- where the column was added.
--
-- Verified on production inside rolled-back transactions:
--   {"cost":"مش رقم"}  → {"ok":false,"errors":[{"row":2,"code":"cost_invalid"}]}
--   {"cost":"12.5"}    → products.cost = 12.50
--   cost column absent → products.cost = NULL, not 0
--
-- NULL rather than 0 for an absent cost is the point: store_margin_report()
-- separates "no cost recorded" from "cost is zero" to report coverage, and a
-- zero would claim a confident 100% margin where there is really no data.

do $do$
declare d text; d2 text;
begin
  select pg_get_functiondef(oid) into d from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'import_products';
  if d is null then raise exception 'import_products not found'; end if;

  -- 1. reject a non-numeric cost cell, mirroring the discount check
  d2 := replace(d,
    $q$    if btrim(coalesce(v_row->>'discount_price', '')) <> ''$q$,
    $q$    if btrim(coalesce(v_row->>'cost', '')) <> ''
       and public.parse_numeric_cell(v_row->>'cost') is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'code', 'cost_invalid');
      continue;
    end if;
    if btrim(coalesce(v_row->>'discount_price', '')) <> ''$q$);
  if d2 = d then raise exception 'patch 1 (validation) did not match'; end if; d := d2;

  -- 2. column list on insert
  d2 := replace(d,
    $q$        price, discount_price, stock, brand, image_url, section_id$q$,
    $q$        price, discount_price, cost, stock, brand, image_url, section_id$q$);
  if d2 = d then raise exception 'patch 2 (insert columns) did not match'; end if; d := d2;

  -- 3. matching value, in the same position
  d2 := replace(d,
    $q$        public.parse_numeric_cell(v_row->>'discount_price'),$q$,
    $q$        public.parse_numeric_cell(v_row->>'discount_price'),
        public.parse_numeric_cell(v_row->>'cost'),$q$);
  if d2 = d then raise exception 'patch 3 (insert values) did not match'; end if; d := d2;

  -- 4. second pass, where an existing SKU is updated
  d2 := replace(d,
    $q$        discount_price = coalesce(public.parse_numeric_cell(v_row->>'discount_price'), discount_price),$q$,
    $q$        discount_price = coalesce(public.parse_numeric_cell(v_row->>'discount_price'), discount_price),
        cost           = coalesce(public.parse_numeric_cell(v_row->>'cost'), cost),$q$);
  if d2 = d then raise exception 'patch 4 (update) did not match'; end if; d := d2;

  execute d;
end
$do$;
