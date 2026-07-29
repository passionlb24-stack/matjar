-- 0198: Two audit fixes.
--   MJ-R06  pos_record_sale stock decrement was a non-atomic read-modify-write
--           (greatest(stock-qty,0)) that silently oversells; make it atomic +
--           reject like the online order path (0073).
--   MJ-A03  new-engine "manage" policies used can_manage_store (ANY staff row),
--           re-scope to staff_can(store, '<section>') so an unpermissioned staffer
--           can't read attendee/guest PII or edit tickets/units — matching the OS
--           sidebar gating (tickets/units→products, stays→bookings, leads→orders).
--           staff_can returns true for the owner, so owner access is unchanged.

-- ── MJ-R06: atomic POS stock ────────────────────────────────────────────────
create or replace function public.pos_record_sale(p_store_id uuid, p_items jsonb, p_discount numeric default 0, p_customer uuid default null, p_note text default null, p_location_id uuid default null)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_item record; v_prod record;
  v_subtotal numeric(12, 2) := 0; v_total numeric(12, 2);
  v_sale uuid; v_price numeric(12, 2); v_location_id uuid;
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty sale';
  end if;
  if p_customer is not null and not exists (
    select 1 from public.store_customers c where c.id = p_customer and c.store_id = p_store_id
  ) then
    raise exception 'customer not in this store';
  end if;

  if p_location_id is not null then
    if not exists (select 1 from public.store_locations where id = p_location_id and store_id = p_store_id and is_active = true) then
      raise exception 'bad_location';
    end if;
    v_location_id := p_location_id;
  else
    select id into v_location_id from public.store_locations
    where store_id = p_store_id and is_primary = true and is_active = true limit 1;
  end if;

  for v_item in
    select (e->>'product_id')::uuid as product_id, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e
  loop
    if v_item.qty is null or v_item.qty <= 0 then raise exception 'invalid quantity'; end if;
    select id, coalesce(discount_price, price) as eff_price into v_prod
      from public.products where id = v_item.product_id and store_id = p_store_id and deleted_at is null;
    if v_prod.id is null then raise exception 'product not found in this store'; end if;
    v_subtotal := v_subtotal + v_prod.eff_price * v_item.qty;
  end loop;

  if p_discount is null or p_discount < 0 or p_discount > v_subtotal then
    raise exception 'invalid discount';
  end if;
  v_total := v_subtotal - p_discount;

  insert into public.pos_sales
    (store_id, subtotal, discount, total, customer_id, note, created_by, location_id)
  values
    (p_store_id, v_subtotal, p_discount, v_total, p_customer, p_note, (select auth.uid()), v_location_id)
  returning id into v_sale;

  for v_item in
    select (e->>'product_id')::uuid as product_id, (e->>'qty')::int as qty
    from jsonb_array_elements(p_items) e
  loop
    select id, name, coalesce(discount_price, price) as eff_price, stock into v_prod
      from public.products where id = v_item.product_id;
    v_price := v_prod.eff_price;

    insert into public.pos_sale_items (sale_id, product_id, name, price, qty)
    values (v_sale, v_prod.id, v_prod.name, v_price, v_item.qty);

    if v_prod.stock is not null then
      -- Atomic + reject: never silently oversell (was greatest(stock-qty,0)).
      update public.products
        set stock = stock - v_item.qty, updated_at = now()
        where id = v_prod.id and stock >= v_item.qty;
      if not found then raise exception 'insufficient_stock'; end if;
      insert into public.stock_movements (store_id, product_id, delta, reason, created_by)
      values (p_store_id, v_prod.id, -v_item.qty, 'sale', (select auth.uid()));
    end if;
  end loop;

  return v_sale;
end $function$;

-- ── MJ-A03: re-scope new-engine manage policies to staff_can(section) ────────
drop policy if exists units_manage on public.accommodation_units;
create policy units_manage on public.accommodation_units for all
  using (public.staff_can(store_id, 'products')) with check (public.staff_can(store_id, 'products'));

drop policy if exists ticket_types_manage on public.event_ticket_types;
create policy ticket_types_manage on public.event_ticket_types for all
  using (public.staff_can(store_id, 'products')) with check (public.staff_can(store_id, 'products'));

drop policy if exists tickets_select on public.event_tickets;
create policy tickets_select on public.event_tickets for select
  using (public.staff_can(store_id, 'products') or customer_id = auth.uid());
drop policy if exists tickets_update_store on public.event_tickets;
create policy tickets_update_store on public.event_tickets for update
  using (public.staff_can(store_id, 'products')) with check (public.staff_can(store_id, 'products'));

drop policy if exists stays_select on public.stay_bookings;
create policy stays_select on public.stay_bookings for select
  using (public.staff_can(store_id, 'bookings') or customer_id = auth.uid());
drop policy if exists stays_update_store on public.stay_bookings;
create policy stays_update_store on public.stay_bookings for update
  using (public.staff_can(store_id, 'bookings')) with check (public.staff_can(store_id, 'bookings'));

drop policy if exists leads_select_store on public.leads;
create policy leads_select_store on public.leads for select
  using (public.staff_can(store_id, 'orders'));
drop policy if exists leads_update_store on public.leads;
create policy leads_update_store on public.leads for update
  using (public.staff_can(store_id, 'orders')) with check (public.staff_can(store_id, 'orders'));
