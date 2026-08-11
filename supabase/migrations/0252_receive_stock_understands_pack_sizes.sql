-- Shops buy in boxes and sell in pieces.
--
-- 0248 counted every received line as loose units, so a kiosk taking in 5 boxes
-- of 24 recorded 5 pieces at the price of a whole box: stock understated by 115
-- and cost overstated 24-fold. Since that cost is what the profit report divides
-- by, a wrong pack size does not just misstate stock, it inverts the margin.
--
-- pack is how many sellable units are in one of whatever the supplier delivers.
-- Default 1 keeps every existing caller — and every shop that genuinely buys by
-- the piece — behaving exactly as before.
create or replace function public.receive_stock(
  p_store_id uuid,
  p_supplier_id uuid,
  p_lines jsonb,
  p_happened_on date default null,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_line jsonb;
  v_product_id uuid;
  v_qty integer;
  v_pack integer;
  v_units integer;
  v_pack_cost numeric(12, 2);
  v_unit_cost numeric(12, 4);
  v_total numeric(12, 2) := 0;
  v_count integer := 0;
  v_on date := coalesce(p_happened_on, (now() at time zone 'Asia/Beirut')::date);
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'no_lines';
  end if;
  if p_supplier_id is not null and not exists (
       select 1 from public.store_suppliers
       where id = p_supplier_id and store_id = p_store_id) then
    raise exception 'supplier_not_found';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line ->> 'product_id')::uuid;
    v_qty        := coalesce((v_line ->> 'qty')::integer, 0);
    v_pack       := coalesce(nullif(v_line ->> 'pack', '')::integer, 1);
    -- The number on the supplier's invoice: the price of one box, not one piece.
    v_pack_cost  := nullif(v_line ->> 'unit_cost', '')::numeric;

    if v_qty <= 0 then
      raise exception 'bad_qty';
    end if;
    if v_pack <= 0 then
      raise exception 'bad_pack';
    end if;
    if not exists (select 1 from public.products
                   where id = v_product_id and store_id = p_store_id) then
      raise exception 'product_not_in_store';
    end if;

    v_units := v_qty * v_pack;
    -- Kept at four decimals before rounding: a 24-pack at $10 is $0.4167 a
    -- piece, and rounding that to $0.42 first would quietly inflate cost of
    -- goods on every single sale afterwards.
    v_unit_cost := case when v_pack_cost is null then null
                        else v_pack_cost / v_pack end;

    -- Stock only moves for products that track it; a butcher selling by weight
    -- leaves stock null and should keep it null rather than jumping to a count
    -- that means nothing.
    update public.products
    set stock = case when stock is null then null else stock + v_units end,
        cost  = coalesce(round(v_unit_cost, 2), cost)
    where id = v_product_id;

    insert into public.stock_movements
      (store_id, product_id, delta, reason, note, created_by)
    values (p_store_id, v_product_id, v_units, 'purchase', p_note, auth.uid());

    -- The debt is what the supplier billed: boxes times box price.
    v_total := v_total + coalesce(v_pack_cost, 0) * v_qty;
    v_count := v_count + 1;
  end loop;

  -- What the shop now owes. Skipped when the lines carried no costs at all,
  -- since a zero debt on the supplier's account is noise, not a record.
  if p_supplier_id is not null and v_total > 0 then
    insert into public.supplier_transactions
      (store_id, supplier_id, kind, label, amount, happened_on)
    values (p_store_id, p_supplier_id, 'purchase',
            coalesce(nullif(btrim(p_note), ''), 'استلام بضاعة'),
            v_total, v_on);
  end if;

  return v_count;
end
$function$;
