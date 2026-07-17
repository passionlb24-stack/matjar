-- Post-review fixes for the branches + payments + service-request features.

-- 1) Every store must always have exactly one primary branch -----------------
--    0084 only backfilled stores that existed then; a store created afterwards
--    had NO branch, so order/POS branch attribution silently resolved to null.
--    Now: auto-create a primary branch on store insert, guarantee single-primary,
--    and backfill any store still missing one.

create or replace function public.create_primary_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_locations
    (store_id, address, region, area, phone, whatsapp, lat, lng, is_primary, is_active)
  values
    (new.id, new.address, new.region, new.area, new.phone, new.whatsapp,
     new.lat, new.lng, true, true);
  return new;
end $$;

drop trigger if exists stores_create_primary_location on public.stores;
create trigger stores_create_primary_location
  after insert on public.stores
  for each row execute function public.create_primary_location();

-- Setting a branch primary demotes the store's other branches (one source of
-- truth). BEFORE so the row being written wins.
create or replace function public.enforce_single_primary_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_primary then
    update public.store_locations set is_primary = false
    where store_id = new.store_id and id <> new.id and is_primary = true;
  end if;
  return new;
end $$;

drop trigger if exists store_locations_single_primary on public.store_locations;
create trigger store_locations_single_primary
  before insert or update on public.store_locations
  for each row execute function public.enforce_single_primary_location();

-- Backfill: any live store with no branch gets a primary from its own fields.
insert into public.store_locations
  (store_id, address, region, area, phone, whatsapp, lat, lng, is_primary, is_active)
select s.id, s.address, s.region, s.area, s.phone, s.whatsapp, s.lat, s.lng, true, true
from public.stores s
where s.deleted_at is null
  and not exists (select 1 from public.store_locations l where l.store_id = s.id);

-- 2) Refund cap: refunds must not exceed what was actually collected ---------
--    (was capped at the order total, so a COD order with nothing recorded could
--    be "refunded", driving admin net-revenue negative). Cap at payments taken.

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_kind text,
  p_amount numeric,
  p_method text default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_store_id uuid;
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_refunded numeric(12, 2);
  v_id uuid;
begin
  select store_id, total into v_store_id, v_total
  from public.orders where id = p_order_id;
  if v_store_id is null then raise exception 'order_not_found'; end if;
  if not (public.can_manage_store(v_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_kind not in ('payment', 'refund') then raise exception 'bad_kind'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;

  select
    coalesce(sum(amount) filter (where kind = 'payment'), 0),
    coalesce(sum(amount) filter (where kind = 'refund'), 0)
  into v_paid, v_refunded
  from public.order_payments where order_id = p_order_id;

  if p_kind = 'payment' and v_paid + p_amount > v_total then
    raise exception 'exceeds_total';
  end if;
  -- A refund can never exceed what has actually been collected.
  if p_kind = 'refund' and v_refunded + p_amount > v_paid then
    raise exception 'exceeds_paid';
  end if;

  insert into public.order_payments
    (order_id, store_id, kind, amount, method, note, actor_id)
  values (
    p_order_id, v_store_id, p_kind::public.payment_kind, p_amount,
    nullif(trim(p_method), ''), nullif(trim(p_note), ''), auth.uid()
  )
  returning id into v_id;
  return v_id;
end; $$;

-- 3) Service-request transitions: don't let terminal states be overwritten ---
--    quote/decline previously updated unconditionally.

create or replace function public.manage_service_request(
  p_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store_id uuid;
  v_customer uuid;
  v_status public.service_request_status;
  v_is_provider boolean;
  v_is_customer boolean;
begin
  select store_id, customer_id, status
  into v_store_id, v_customer, v_status
  from public.service_requests where id = p_id;
  if v_store_id is null then raise exception 'not_found'; end if;

  v_is_provider := public.can_manage_store(v_store_id) or public.is_super_admin();
  v_is_customer := v_customer is not null and v_customer = auth.uid();
  if not (v_is_provider or v_is_customer) then
    raise exception 'not_authorized';
  end if;

  if p_action = 'quote' and v_is_provider then
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    update public.service_requests
      set status = 'quoted', quote_amount = p_amount,
          quote_note = nullif(trim(p_note), '')
      where id = p_id and status in ('pending', 'quoted');
  elsif p_action = 'decline' and v_is_provider then
    update public.service_requests set status = 'declined'
      where id = p_id and status in ('pending', 'quoted', 'accepted', 'in_progress');
  elsif p_action = 'start' and v_is_provider then
    update public.service_requests set status = 'in_progress'
      where id = p_id and status = 'accepted';
  elsif p_action = 'complete' and v_is_provider then
    update public.service_requests set status = 'completed'
      where id = p_id and status in ('accepted', 'in_progress');
  elsif p_action = 'accept' and v_is_customer then
    update public.service_requests set status = 'accepted'
      where id = p_id and status = 'quoted';
  elsif p_action = 'cancel' and v_is_customer then
    update public.service_requests set status = 'cancelled'
      where id = p_id and status in ('pending', 'quoted', 'accepted');
  else
    raise exception 'bad_action';
  end if;
end; $$;

-- 4) Perf: order_payments RLS re-evaluated auth.uid() per row -----------------
drop policy if exists order_payments_select on public.order_payments;
create policy order_payments_select on public.order_payments for select
  using (
    public.can_manage_store(store_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = (select auth.uid())
    )
  );

-- 5) Perf: drop duplicate trigram indexes (0080 re-created ones that already
--    existed under a shorter name). Keep the originals.
drop index if exists public.idx_products_name_trgm;
drop index if exists public.idx_stores_name_trgm;
