-- 0178: booking waitlist. When a service/day is fully booked, a customer can
-- join the waitlist for it. When any booking on that store+service+date frees
-- up (cancelled / rejected / no_show), the earliest still-waiting customer is
-- notified — first-come first-served, each entry notified at most once.

create table if not exists public.booking_waitlist (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  requested_date date not null,
  customer_name text,
  phone text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

-- One live waitlist entry per customer per service+date (re-joining after being
-- notified is allowed since the partial index only covers un-notified rows).
create unique index if not exists booking_waitlist_unique_live
  on public.booking_waitlist (customer_id, product_id, requested_date)
  where notified_at is null;
create index if not exists booking_waitlist_lookup
  on public.booking_waitlist (store_id, product_id, requested_date)
  where notified_at is null;

alter table public.booking_waitlist enable row level security;

-- Customer sees + manages their own rows; store team sees their store's list.
drop policy if exists booking_waitlist_select on public.booking_waitlist;
create policy booking_waitlist_select on public.booking_waitlist
  for select using (
    customer_id = auth.uid() or public.can_manage_store(store_id)
  );
drop policy if exists booking_waitlist_delete on public.booking_waitlist;
create policy booking_waitlist_delete on public.booking_waitlist
  for delete using (customer_id = auth.uid());

-- Join via RPC (validates the service belongs to the store and is bookable).
create or replace function public.join_booking_waitlist(
  p_store_id uuid,
  p_product_id uuid,
  p_date date,
  p_doctor_id uuid default null,
  p_customer_name text default null,
  p_phone text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;
  if p_date is null then
    return jsonb_build_object('ok', false, 'code', 'bad_date');
  end if;
  if not exists (
    select 1 from public.products p join public.stores s on s.id = p.store_id
    where p.id = p_product_id and p.store_id = p_store_id
      and p.status = 'active' and p.deleted_at is null
      and s.status = 'active' and s.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'service_unavailable');
  end if;

  begin
    insert into public.booking_waitlist
      (store_id, product_id, doctor_id, customer_id, requested_date,
       customer_name, phone)
    values
      (p_store_id, p_product_id, p_doctor_id, v_uid, p_date,
       nullif(trim(coalesce(p_customer_name,'')),''),
       nullif(trim(coalesce(p_phone,'')),''))
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_waiting');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke execute on function
  public.join_booking_waitlist(uuid, uuid, date, uuid, text, text) from public, anon;
grant execute on function
  public.join_booking_waitlist(uuid, uuid, date, uuid, text, text) to authenticated;

-- When a booking frees up, notify the earliest waiting customer for that
-- store+service+date (one seat freed → one person nudged).
create or replace function public.notify_booking_waitlist()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_w record;
  v_store_name text;
begin
  if new.status in ('cancelled', 'rejected', 'no_show')
     and old.status is distinct from new.status
     and new.product_id is not null then
    select w.* into v_w
    from public.booking_waitlist w
    where w.store_id = new.store_id
      and w.product_id = new.product_id
      and w.requested_date = new.requested_date
      and w.notified_at is null
    order by w.created_at
    limit 1;
    if found then
      select name into v_store_name from public.stores where id = new.store_id;
      insert into public.notifications (user_id, type, data)
      values (v_w.customer_id, 'booking_slot_freed',
              jsonb_build_object(
                'store_id', new.store_id,
                'store_name', v_store_name,
                'product_id', new.product_id,
                'service_name', new.service_name,
                'date', new.requested_date));
      update public.booking_waitlist set notified_at = now() where id = v_w.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_booking_waitlist on public.bookings;
create trigger trg_notify_booking_waitlist
  after update of status on public.bookings
  for each row execute function public.notify_booking_waitlist();
