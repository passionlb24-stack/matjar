-- 0191: Accommodation engine (Model D). Hotels/chalets/guesthouses need a
-- date-range STAY, not the hourly booking the platform forced them into. A
-- booking is a [check_in, check_out) night range on a unit; a btree_gist
-- exclusion constraint prevents overlapping bookings per unit (the double-book
-- guard, night = inventory grain). Pricing is per-night with a weekend rate,
-- computed server-side. Additive only.

create extension if not exists btree_gist;

do $$ begin
  create type public.stay_status as enum
    ('requested','confirmed','declined','checked_in','checked_out','completed','cancelled','no_show');
exception when duplicate_object then null; end $$;

-- One row = one bookable unit (a chalet, an apartment, a specific room). Hotels
-- with N identical rooms create N rows (or one per room-type in a later phase).
create table if not exists public.accommodation_units (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  name_en text,
  description text,
  unit_type text,                       -- chalet | apartment | room | villa | ...
  max_guests int not null default 2 check (max_guests between 1 and 50),
  bedrooms int not null default 1,
  bathrooms int not null default 1,
  base_nightly_price numeric not null default 0 check (base_nightly_price >= 0),
  weekend_price numeric check (weekend_price >= 0),      -- Fri/Sat; null = base
  min_nights int not null default 1 check (min_nights between 1 and 90),
  cleaning_fee numeric not null default 0 check (cleaning_fee >= 0),
  security_deposit numeric not null default 0 check (security_deposit >= 0),
  check_in_time text,
  check_out_time text,
  cancellation_policy text,
  amenities jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accommodation_units_store_idx on public.accommodation_units (store_id, sort_order);

create table if not exists public.stay_bookings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  unit_id uuid not null references public.accommodation_units(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  phone text not null,
  check_in date not null,
  check_out date not null,
  nights int not null,
  adults int not null default 1,
  children int not null default 0,
  base_total numeric not null default 0,
  cleaning_fee numeric not null default 0,
  deposit_amount numeric not null default 0,
  grand_total numeric not null default 0,
  notes text,
  status public.stay_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stay_valid_range check (check_out > check_in)
);
create index if not exists stay_bookings_store_idx on public.stay_bookings (store_id, check_in);
create index if not exists stay_bookings_unit_idx on public.stay_bookings (unit_id, check_in);

-- Double-booking guard: no two live bookings on the same unit may overlap.
-- Terminal statuses (declined/cancelled/checked_out/completed/no_show) free the
-- range. daterange is [check_in, check_out) so back-to-back stays don't clash.
alter table public.stay_bookings drop constraint if exists stay_no_overlap;
alter table public.stay_bookings add constraint stay_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status in ('requested','confirmed','checked_in'));

alter table public.accommodation_units enable row level security;
alter table public.stay_bookings enable row level security;

-- Units: public reads active units; managers manage their own.
drop policy if exists units_public_read on public.accommodation_units;
create policy units_public_read on public.accommodation_units for select
  using (active = true or public.can_manage_store(store_id));
drop policy if exists units_manage on public.accommodation_units;
create policy units_manage on public.accommodation_units for all
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Stay bookings: managers see/manage their store's; customers see their own.
-- Inserts go through place_stay_booking() (definer) — no public insert policy.
drop policy if exists stays_select on public.stay_bookings;
create policy stays_select on public.stay_bookings for select
  using (public.can_manage_store(store_id) or customer_id = auth.uid());
drop policy if exists stays_update_store on public.stay_bookings;
create policy stays_update_store on public.stay_bookings for update
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Per-night price sum for a unit over [check_in, check_out): weekend (Fri=5,
-- Sat=6) uses weekend_price when set, else base.
create or replace function public.stay_base_total(
  p_unit public.accommodation_units, p_check_in date, p_check_out date
) returns numeric language sql immutable as $$
  select coalesce(sum(
    case when extract(dow from d) in (5, 6)
         then coalesce(p_unit.weekend_price, p_unit.base_nightly_price)
         else p_unit.base_nightly_price end), 0)
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') d;
$$;

-- Available units for a date range + guest count, with computed pricing.
create or replace function public.search_stay(
  p_store_id uuid, p_check_in date, p_check_out date, p_guests int
) returns table (
  unit_id uuid, name text, name_en text, unit_type text, max_guests int,
  bedrooms int, bathrooms int, images jsonb, amenities jsonb,
  nights int, base_total numeric, cleaning_fee numeric, deposit numeric,
  grand_total numeric, min_nights int
) language plpgsql security definer set search_path = '' as $$
declare v_nights int;
begin
  if p_check_out <= p_check_in or p_check_in < current_date then
    raise exception 'invalid_range';
  end if;
  v_nights := p_check_out - p_check_in;
  return query
  select u.id, u.name, u.name_en, u.unit_type, u.max_guests, u.bedrooms,
         u.bathrooms, u.images, u.amenities, v_nights,
         public.stay_base_total(u, p_check_in, p_check_out) as base_total,
         u.cleaning_fee, u.security_deposit,
         public.stay_base_total(u, p_check_in, p_check_out) + u.cleaning_fee as grand_total,
         u.min_nights
  from public.accommodation_units u
  where u.store_id = p_store_id and u.active
    and u.max_guests >= greatest(coalesce(p_guests, 1), 1)
    and v_nights >= u.min_nights
    and not exists (
      select 1 from public.stay_bookings b
      where b.unit_id = u.id
        and b.status in ('requested','confirmed','checked_in')
        and daterange(b.check_in, b.check_out, '[)')
            && daterange(p_check_in, p_check_out, '[)'))
  order by grand_total;
end; $$;

grant execute on function public.search_stay(uuid, date, date, int) to anon, authenticated;

-- Create a stay booking (request). Guest-capable, server-priced, atomic against
-- the exclusion constraint; notifies the owner.
create or replace function public.place_stay_booking(
  p_unit_id uuid, p_check_in date, p_check_out date,
  p_adults int, p_children int, p_name text, p_phone text, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_unit public.accommodation_units;
  v_id uuid; v_owner uuid; v_store_name text;
  v_nights int; v_base numeric;
  v_uid uuid := auth.uid();
begin
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_phone),'')='' then
    raise exception 'missing_fields';
  end if;
  if p_check_out <= p_check_in or p_check_in < current_date then
    raise exception 'invalid_range';
  end if;
  select * into v_unit from public.accommodation_units where id = p_unit_id and active;
  if v_unit.id is null then raise exception 'unit_not_found'; end if;

  v_nights := p_check_out - p_check_in;
  if v_nights < v_unit.min_nights then raise exception 'min_stay'; end if;
  if greatest(coalesce(p_adults,1),1) + greatest(coalesce(p_children,0),0) > v_unit.max_guests then
    raise exception 'over_capacity';
  end if;

  select owner_id, name into v_owner, v_store_name from public.stores where id = v_unit.store_id;
  v_base := public.stay_base_total(v_unit, p_check_in, p_check_out);

  begin
    insert into public.stay_bookings (
      store_id, unit_id, customer_id, guest_name, phone, check_in, check_out,
      nights, adults, children, base_total, cleaning_fee, deposit_amount,
      grand_total, notes)
    values (
      v_unit.store_id, p_unit_id, v_uid, trim(p_name), trim(p_phone),
      p_check_in, p_check_out, v_nights,
      greatest(coalesce(p_adults,1),1), greatest(coalesce(p_children,0),0),
      v_base, v_unit.cleaning_fee, v_unit.security_deposit,
      v_base + v_unit.cleaning_fee, nullif(trim(coalesce(p_notes,'')),''))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'dates_taken';
  end;

  insert into public.notifications (user_id, type, data)
  values (v_owner, 'stay_new', jsonb_build_object(
    'stay_id', v_id, 'store_id', v_unit.store_id, 'store_name', v_store_name,
    'unit_name', v_unit.name, 'check_in', p_check_in, 'check_out', p_check_out));

  return v_id;
end; $$;

grant execute on function public.place_stay_booking(uuid, date, date, int, int, text, text, text)
  to anon, authenticated;

-- Manager updates a stay's status.
create or replace function public.update_stay_status(p_id uuid, p_status public.stay_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_store uuid;
begin
  select store_id into v_store from public.stay_bookings where id = p_id;
  if v_store is null then raise exception 'not_found'; end if;
  if not public.can_manage_store(v_store) then raise exception 'forbidden'; end if;
  update public.stay_bookings set status = p_status, updated_at = now() where id = p_id;
end; $$;

grant execute on function public.update_stay_status(uuid, public.stay_status) to authenticated;
