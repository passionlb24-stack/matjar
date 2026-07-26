-- Booking engine v2: allocation MODES per service (not per store type).
-- The old model had one conflict rule for everything; real businesses differ —
-- a doctor can't take two overlapping visits even for different services, a
-- lab takes 8 people per slot, a team salon books whoever is free, and some
-- centers just want requests they confirm manually. Each service now declares
-- HOW it is delivered:
--   provider_exclusive  عيادة/حلّاق: الشخص المختار ما بينحجز مرّتين متداخلتين
--   pooled_providers    فريق: الزبون بيختار شخص أو «أي متاح» والنظام بيوزّع
--   capacity_based      مختبر/حصص: كل وقت إلو سعة
--   request_based       طلب موعد بينتظر موافقة — ما بيقفل الوقت
-- Legacy services (mode null) keep today's exact behavior (old unique indexes).
-- Durations become real: per-service duration + buffer, and overlap is guarded
-- by RANGE exclusion constraints (btree_gist), not equal-time uniques.

create extension if not exists btree_gist;

-- Per-service booking configuration.
alter table public.products add column if not exists booking_allocation_mode text
  check (booking_allocation_mode in
    ('provider_exclusive','pooled_providers','capacity_based','request_based'));
alter table public.products add column if not exists duration_minutes int
  check (duration_minutes between 5 and 480);
alter table public.products add column if not exists buffer_minutes int not null default 0;
alter table public.products add column if not exists capacity_per_slot int
  check (capacity_per_slot >= 1);

-- Real time ranges + a mode snapshot on each booking.
alter table public.bookings add column if not exists starts_at timestamptz;
alter table public.bookings add column if not exists ends_at timestamptz;
alter table public.bookings add column if not exists allocation_mode text;

-- Provider weekly hours (none for a provider = store hours apply).
create table if not exists public.provider_availability_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists par_doctor_idx on public.provider_availability_rules (doctor_id, weekday) where active;
alter table public.provider_availability_rules enable row level security;
create policy "par_select_public" on public.provider_availability_rules
  for select using (active or public.can_manage_store(store_id));
create policy "par_manage" on public.provider_availability_rules
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Date exceptions: a day off or custom hours (also = "block time").
create table if not exists public.provider_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  on_date date not null,
  kind text not null default 'unavailable' check (kind in ('unavailable','custom')),
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists pae_doctor_idx on public.provider_availability_exceptions (doctor_id, on_date);
alter table public.provider_availability_exceptions enable row level security;
create policy "pae_select_public" on public.provider_availability_exceptions
  for select using (true);
create policy "pae_manage" on public.provider_availability_exceptions
  for all using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Range-overlap guards. Only rows written by the new engine (starts_at set)
-- participate; request_based never blocks; terminal statuses release the slot.
alter table public.bookings drop constraint if exists bookings_provider_no_overlap;
alter table public.bookings add constraint bookings_provider_no_overlap
  exclude using gist (doctor_id with =, tstzrange(starts_at, ends_at) with &&)
  where (doctor_id is not null and starts_at is not null
         and allocation_mode in ('provider_exclusive','pooled_providers')
         and status in ('pending','accepted','scheduled'));

alter table public.bookings drop constraint if exists bookings_solo_exclusive_no_overlap;
alter table public.bookings add constraint bookings_solo_exclusive_no_overlap
  exclude using gist (store_id with =, tstzrange(starts_at, ends_at) with &&)
  where (allocation_mode = 'provider_exclusive' and doctor_id is null
         and starts_at is not null
         and status in ('pending','accepted','scheduled'));

-- ===== Availability read model =====
-- One call gives the panel everything to draw the day grid: mode/duration,
-- blocking ranges (semantics per mode), the provider's windows for that day,
-- and full-day blocks. Times are Asia/Beirut (the platform's market).
create or replace function public.get_booking_busy(
  p_store_id uuid,
  p_product_id uuid,
  p_date date,
  p_doctor_id uuid default null,
  p_any boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_p record;
  v_mode text;
  v_dur int;
  v_slot int;
  v_busy jsonb := '[]'::jsonb;
  v_by_provider jsonb := '{}'::jsonb;
  v_windows jsonb := null;
  v_blocked boolean := false;
  v_rules_exist boolean;
begin
  select p.booking_allocation_mode, p.duration_minutes, p.buffer_minutes,
         p.capacity_per_slot, s.booking_slot_minutes
    into v_p
  from public.products p join public.stores s on s.id = p.store_id
  where p.id = p_product_id and p.store_id = p_store_id
    and p.status = 'active' and p.deleted_at is null;
  if not found then raise exception 'service_unavailable'; end if;

  v_mode := v_p.booking_allocation_mode;
  v_slot := coalesce(v_p.booking_slot_minutes, 30);
  v_dur  := coalesce(v_p.duration_minutes, v_slot);

  -- Blocking ranges. Legacy rows (starts_at null) get a synthesized range of
  -- one store slot so old bookings still block correctly.
  if v_mode = 'capacity_based' then
    select coalesce(jsonb_agg(jsonb_build_object(
             's', coalesce(b.starts_at, (b.requested_date + b.requested_time::time) at time zone 'Asia/Beirut'),
             'e', coalesce(b.ends_at,   ((b.requested_date + b.requested_time::time) + make_interval(mins => v_slot)) at time zone 'Asia/Beirut')
           )), '[]'::jsonb) into v_busy
    from public.bookings b
    where b.store_id = p_store_id and b.product_id = p_product_id
      and b.status in ('pending','accepted','scheduled')
      and coalesce(b.starts_at::date, b.requested_date) = p_date;
  elsif v_mode = 'request_based' then
    v_busy := '[]'::jsonb;
  elsif v_mode = 'pooled_providers' and p_any then
    -- Per-provider busy map: a slot is offerable if SOME qualified provider is free.
    select coalesce(jsonb_object_agg(q.did, q.ranges), '{}'::jsonb) into v_by_provider
    from (
      select d.id as did,
             coalesce(jsonb_agg(jsonb_build_object('s', b.starts_at, 'e', b.ends_at))
                      filter (where b.id is not null), '[]'::jsonb) as ranges
      from public.doctors d
      left join public.bookings b
        on b.doctor_id = d.id
       and b.status in ('pending','accepted','scheduled')
       and b.starts_at is not null
       and b.starts_at::date = p_date
      where d.store_id = p_store_id
        and (not exists (select 1 from public.service_providers sp where sp.product_id = p_product_id)
             or exists (select 1 from public.service_providers sp
                        where sp.product_id = p_product_id and sp.doctor_id = d.id))
      group by d.id
    ) q;
  elsif p_doctor_id is not null then
    -- Chosen person: anything on THEIR calendar blocks, whatever the service.
    select coalesce(jsonb_agg(jsonb_build_object(
             's', coalesce(b.starts_at, (b.requested_date + b.requested_time::time) at time zone 'Asia/Beirut'),
             'e', coalesce(b.ends_at,   ((b.requested_date + b.requested_time::time) + make_interval(mins => v_slot)) at time zone 'Asia/Beirut')
           )), '[]'::jsonb) into v_busy
    from public.bookings b
    where b.doctor_id = p_doctor_id
      and b.status in ('pending','accepted','scheduled')
      and coalesce(b.starts_at::date, b.requested_date) = p_date;
  elsif v_mode = 'provider_exclusive' then
    -- Solo exclusive: the whole store is one calendar.
    select coalesce(jsonb_agg(jsonb_build_object(
             's', coalesce(b.starts_at, (b.requested_date + b.requested_time::time) at time zone 'Asia/Beirut'),
             'e', coalesce(b.ends_at,   ((b.requested_date + b.requested_time::time) + make_interval(mins => v_slot)) at time zone 'Asia/Beirut')
           )), '[]'::jsonb) into v_busy
    from public.bookings b
    where b.store_id = p_store_id
      and b.status in ('pending','accepted','scheduled')
      and coalesce(b.starts_at::date, b.requested_date) = p_date
      and (b.allocation_mode = 'provider_exclusive' or b.product_id = p_product_id);
  else
    -- Legacy semantics: per-service.
    select coalesce(jsonb_agg(jsonb_build_object(
             's', coalesce(b.starts_at, (b.requested_date + b.requested_time::time) at time zone 'Asia/Beirut'),
             'e', coalesce(b.ends_at,   ((b.requested_date + b.requested_time::time) + make_interval(mins => v_slot)) at time zone 'Asia/Beirut')
           )), '[]'::jsonb) into v_busy
    from public.bookings b
    where b.store_id = p_store_id and b.product_id = p_product_id
      and b.status in ('pending','accepted','scheduled')
      and coalesce(b.starts_at::date, b.requested_date) = p_date;
  end if;

  -- Provider day windows + exceptions (chosen-provider flows only).
  if p_doctor_id is not null then
    select exists (select 1 from public.provider_availability_rules r
                   where r.doctor_id = p_doctor_id and r.active) into v_rules_exist;
    if v_rules_exist then
      select coalesce(jsonb_agg(jsonb_build_object(
               's', r.start_time, 'e', r.end_time)), '[]'::jsonb) into v_windows
      from public.provider_availability_rules r
      where r.doctor_id = p_doctor_id and r.active
        and r.weekday = extract(dow from p_date)::int;
    end if;
    if exists (select 1 from public.provider_availability_exceptions x
               where x.doctor_id = p_doctor_id and x.on_date = p_date
                 and x.kind = 'unavailable' and x.start_time is null) then
      v_blocked := true;
    end if;
    -- Partial blocks become busy ranges.
    select v_busy || coalesce(jsonb_agg(jsonb_build_object(
             's', (x.on_date + x.start_time) at time zone 'Asia/Beirut',
             'e', (x.on_date + x.end_time) at time zone 'Asia/Beirut')), '[]'::jsonb)
      into v_busy
    from public.provider_availability_exceptions x
    where x.doctor_id = p_doctor_id and x.on_date = p_date
      and x.start_time is not null and x.end_time is not null;
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'duration', v_dur,
    'buffer', coalesce(v_p.buffer_minutes, 0),
    'capacity', v_p.capacity_per_slot,
    'busy', v_busy,
    'busy_by_provider', v_by_provider,
    'windows', v_windows,
    'blocked', v_blocked
  );
end $$;
revoke execute on function public.get_booking_busy(uuid, uuid, date, uuid, boolean) from public;
grant execute on function public.get_booking_busy(uuid, uuid, date, uuid, boolean) to anon, authenticated;

-- ===== Placement: the single write path for the new engine =====
create or replace function public.place_booking(
  p_store_id uuid,
  p_product_id uuid,
  p_date date,
  p_time text,
  p_doctor_id uuid default null,
  p_any boolean default false,
  p_customer_name text default null,
  p_phone text default null,
  p_notes text default null,
  p_coupon text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p record;
  v_mode text;
  v_slot int;
  v_dur int;
  v_buf int;
  v_start timestamptz;
  v_end timestamptz;
  v_doctor uuid := p_doctor_id;
  v_price numeric(12,2);
  v_discount numeric(12,2) := 0;
  v_coupon record;
  v_id uuid;
  v_cnt int;
  v_rules_exist boolean;
  v_ok_window boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;
  if p_date is null or p_time is null or length(trim(p_time)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_time');
  end if;

  select p.*, s.booking_slot_minutes as store_slot
    into v_p
  from public.products p join public.stores s on s.id = p.store_id
  where p.id = p_product_id and p.store_id = p_store_id
    and p.status = 'active' and p.deleted_at is null
    and s.status = 'active' and s.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'service_unavailable');
  end if;

  v_mode := v_p.booking_allocation_mode;
  v_slot := coalesce(v_p.store_slot, 30);
  v_dur  := coalesce(v_p.duration_minutes, v_slot);
  v_buf  := coalesce(v_p.buffer_minutes, 0);
  v_start := (p_date + p_time::time) at time zone 'Asia/Beirut';
  v_end   := v_start + make_interval(mins => v_dur + v_buf);
  v_price := coalesce(v_p.discount_price, v_p.price);

  -- Pooled + "any available": auto-assign the first qualified free provider.
  if v_mode = 'pooled_providers' and (p_any or v_doctor is null) then
    select d.id into v_doctor
    from public.doctors d
    where d.store_id = p_store_id
      and (not exists (select 1 from public.service_providers sp where sp.product_id = p_product_id)
           or exists (select 1 from public.service_providers sp
                      where sp.product_id = p_product_id and sp.doctor_id = d.id))
      and not exists (
        select 1 from public.bookings b
        where b.doctor_id = d.id
          and b.status in ('pending','accepted','scheduled')
          and b.starts_at is not null
          and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_start, v_end)
      )
      and not exists (
        select 1 from public.provider_availability_exceptions x
        where x.doctor_id = d.id and x.on_date = p_date
          and (x.start_time is null
               or (v_start, v_end) overlaps
                  ((x.on_date + x.start_time) at time zone 'Asia/Beirut',
                   (x.on_date + x.end_time) at time zone 'Asia/Beirut'))
      )
      and (
        not exists (select 1 from public.provider_availability_rules r
                    where r.doctor_id = d.id and r.active)
        or exists (
          select 1 from public.provider_availability_rules r
          where r.doctor_id = d.id and r.active
            and r.weekday = extract(dow from p_date)::int
            and p_time::time >= r.start_time
            and (p_time::time + make_interval(mins => v_dur))::time <= r.end_time
        )
      )
    order by d.sort_order nulls last, d.id
    limit 1;
    if v_doctor is null then
      return jsonb_build_object('ok', false, 'code', 'no_provider_free');
    end if;
  end if;

  -- Chosen-provider hours check (rules exist → the slot must fit a window;
  -- a full-day or overlapping exception refuses).
  if v_doctor is not null then
    select exists (select 1 from public.provider_availability_rules r
                   where r.doctor_id = v_doctor and r.active) into v_rules_exist;
    if v_rules_exist then
      select exists (
        select 1 from public.provider_availability_rules r
        where r.doctor_id = v_doctor and r.active
          and r.weekday = extract(dow from p_date)::int
          and p_time::time >= r.start_time
          and (p_time::time + make_interval(mins => v_dur))::time <= r.end_time
      ) into v_ok_window;
      if not v_ok_window then
        return jsonb_build_object('ok', false, 'code', 'outside_hours');
      end if;
    end if;
    if exists (
      select 1 from public.provider_availability_exceptions x
      where x.doctor_id = v_doctor and x.on_date = p_date
        and (x.start_time is null
             or (v_start, v_end) overlaps
                ((x.on_date + x.start_time) at time zone 'Asia/Beirut',
                 (x.on_date + x.end_time) at time zone 'Asia/Beirut'))
    ) then
      return jsonb_build_object('ok', false, 'code', 'outside_hours');
    end if;
  end if;

  -- Capacity mode: serialized count against capacity_per_slot.
  if v_mode = 'capacity_based' then
    perform pg_advisory_xact_lock(
      hashtext('booking_cap:' || p_product_id::text || ':' || v_start::text));
    select count(*) into v_cnt
    from public.bookings b
    where b.product_id = p_product_id
      and b.status in ('pending','accepted','scheduled')
      and b.starts_at is not null
      and tstzrange(b.starts_at, b.ends_at) && tstzrange(v_start, v_end);
    if v_cnt >= coalesce(v_p.capacity_per_slot, 1) then
      return jsonb_build_object('ok', false, 'code', 'capacity_full');
    end if;
    v_doctor := null;
  end if;

  -- Coupon against the service price (same validator as orders).
  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon
    from public.validate_coupon(p_store_id, upper(trim(p_coupon)), coalesce(v_price, 0));
    if v_coupon.valid then v_discount := coalesce(v_coupon.discount, 0); end if;
  end if;

  begin
    insert into public.bookings (
      store_id, customer_id, product_id, service_name,
      requested_date, requested_time, customer_name, phone, notes,
      status, doctor_id, coupon_code, discount,
      starts_at, ends_at, allocation_mode
    ) values (
      p_store_id, v_uid, p_product_id, v_p.name,
      p_date, trim(p_time), nullif(trim(coalesce(p_customer_name,'')),''),
      nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_notes,'')),''),
      'pending', v_doctor,
      case when v_discount > 0 then upper(trim(p_coupon)) end,
      coalesce(v_discount, 0),
      -- Legacy services (no mode) keep the old contract: no range, old unique
      -- indexes stay the guard. New-engine rows carry the real range.
      case when v_mode is null then null else v_start end,
      case when v_mode is null then null else v_end end,
      v_mode
    ) returning id into v_id;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'code', 'slot_taken');
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'slot_taken');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke execute on function
  public.place_booking(uuid, uuid, date, text, uuid, boolean, text, text, text, text) from public;
grant execute on function
  public.place_booking(uuid, uuid, date, text, uuid, boolean, text, text, text, text)
  to authenticated;

-- Scope the legacy per-service equal-time unique to LEGACY rows only
-- (allocation_mode null): new-engine rows use the range constraints,
-- capacity_based counts in the RPC, request_based never blocks.
drop index if exists public.bookings_no_double_book_service;
create unique index bookings_no_double_book_service
  on public.bookings (store_id, product_id, requested_date, requested_time)
  where requested_time is not null
    and doctor_id is null and resource_id is null and class_id is null
    and party_size is null and product_id is not null
    and allocation_mode is null
    and status in ('pending','accepted','scheduled');
