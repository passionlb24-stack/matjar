-- The missing link between three modules that already existed.
--
-- Suppliers held debts. Inventory held quantities. Products held a cost price
-- nobody filled. Nothing joined them, so receiving a delivery meant a merchant
-- typing the same event into three screens — and they typed it into none:
-- across the platform, one stock movement and zero supplier transactions.
--
-- One action instead. Goods arrive: stock goes up, the cost price is refreshed
-- from what was actually paid, and the supplier is owed the money. All three or
-- none, because a delivery that only half-registered is worse than one that was
-- never entered — it makes the numbers look maintained while they drift.
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
  v_unit_cost numeric(12, 2);
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
  -- A supplier is optional (a cash purchase from the market has no account),
  -- but if one is named it must belong to this store.
  if p_supplier_id is not null and not exists (
       select 1 from public.store_suppliers
       where id = p_supplier_id and store_id = p_store_id) then
    raise exception 'supplier_not_found';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line ->> 'product_id')::uuid;
    v_qty        := coalesce((v_line ->> 'qty')::integer, 0);
    v_unit_cost  := nullif(v_line ->> 'unit_cost', '')::numeric;

    if v_qty <= 0 then
      raise exception 'bad_qty';
    end if;
    if not exists (select 1 from public.products
                   where id = v_product_id and store_id = p_store_id) then
      raise exception 'product_not_in_store';
    end if;

    -- Stock only moves for products that track it; a butcher selling by weight
    -- leaves stock null and should keep it null rather than jumping to a count
    -- that means nothing.
    update public.products
    set stock = case when stock is null then null else stock + v_qty end,
        cost  = coalesce(v_unit_cost, cost)
    where id = v_product_id;

    insert into public.stock_movements
      (store_id, product_id, delta, reason, note, created_by)
    values (p_store_id, v_product_id, v_qty, 'purchase', p_note, auth.uid());

    v_total := v_total + coalesce(v_unit_cost, 0) * v_qty;
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

revoke all on function public.receive_stock(uuid, uuid, jsonb, date, text) from public;
grant execute on function public.receive_stock(uuid, uuid, jsonb, date, text) to authenticated;
