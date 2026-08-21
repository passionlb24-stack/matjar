-- 0298: Car-rental engine (MJ-003). Additive only.
--
-- WHAT WAS WRONG
--   `rentals` has been a feature-module key since the module catalog was
--   written, is declared by the automotive and hospitality sector bundles, and
--   is implemented by nothing. src/lib/feature-availability.ts said so in as
--   many words: state "soon", surface "— not built". Automotive was therefore
--   held in DIRECTORY_ONLY_SECTORS — browse and contact, no transaction —
--   because the only transaction the platform could have offered it was a cart
--   and cash-on-delivery for a car, which is worse than none.
--
-- WHAT THIS IS
--   The same engine as the accommodation stay (0191), applied to a vehicle. A
--   rental is a [pickup_date, return_date) day range on ONE vehicle; a
--   btree_gist exclusion constraint makes two live rentals on the same vehicle
--   over overlapping days impossible at the storage layer, not in application
--   code. Pricing is per day with an optional weekend rate, computed
--   server-side. Nothing here is a second, subtly different date-range booker:
--   the range type, the half-open bound, the live-status predicate, the
--   definer-RPC shape, the guest rate limit and the `dates_taken` error are
--   copied from the stay engine on purpose, so a fix to one is legible as the
--   fix the other needs.
--
-- WHAT GENUINELY DIFFERS FROM THE STAY ENGINE, AND WHY
--   1. RLS predicate. 0191 gates both its tables on can_manage_store(), which
--      is true for ANY staff row. 0159 moved the Business-OS tables to
--      staff_can(store_id, perm) and 0291 fixed the five siblings that had been
--      left behind. A new table has no reason to be born on the old predicate,
--      so writes here need staff_can(store_id,'products') for the fleet and
--      staff_can(store_id,'bookings') for the bookings. Reads for the customer
--      are unchanged in shape.
--   2. Driver age. A vehicle carries a minimum driver age and a booking records
--      the age the renter stated; the RPC refuses a booking under the minimum.
--      A stay has no equivalent. The renter's LICENCE is deliberately not
--      stored — the merchant inspects it in person at pickup, and a licence
--      number in this table would be identity data Matjar has no use for.
--   3. Mileage. daily_km_limit (null = unlimited) + extra_km_price, snapshotted
--      onto the booking so a later price change cannot rewrite what a customer
--      was quoted. A stay has no meter.
--   4. Insurance. insurance_included + a free-text note, snapshotted the same
--      way. Matjar is not an insurer and does not verify the claim; it repeats
--      what the merchant stated, which is what the storefront copy says.
--
-- THE DEPOSIT IS STATED, NEVER HELD
--   Matjar processes no cards. There is no payment provider anywhere in the
--   repository (see feature-availability.ts, `onlinePayment: soon`) and the
--   whole order path is cash on delivery. So `deposit_amount` is a NUMBER THE
--   MERCHANT PUBLISHES and collects in cash, in person, at pickup. Matjar does
--   not authorise it, hold it, escrow it or refund it, and no code in this
--   migration moves money. That is why the deposit is EXCLUDED from
--   grand_total: putting it in the total would make the storefront read as
--   though the platform were collecting it. Same choice the stay engine made
--   with security_deposit, and it is the honest one. The storefront copy says
--   this in both locales rather than leaving the customer to assume.
--
-- SAME-DAY RENTALS ARE NOT SUPPORTED, ON PURPOSE
--   `rental_valid_range` requires return_date > pickup_date, so the minimum
--   rental is one day and the daterange is never EMPTY. This matters: an empty
--   range overlaps nothing, so a pickup_date = return_date row would slip past
--   the exclusion constraint entirely and double-book the car silently. The
--   check constraint is what makes the guarantee total. An hourly rental is a
--   different engine and is not claimed anywhere.
--
--   Half-open '[)' means back-to-back rentals do not clash: a car held
--   Fri→Sun is free from Sun, the same way a room checked out of on Sunday is
--   free that Sunday. pickup_time / return_time are the merchant's stated hours
--   for the customer to read; they are NOT part of the exclusion and are not
--   pretending to be a turnaround guarantee.
--
-- VERIFIED IN A ROLLED-BACK TRANSACTION AGAINST PRODUCTION BEFORE APPLYING —
-- see the statements and Postgres' refusals quoted at the foot of this file.

create extension if not exists btree_gist;

do $$ begin
  create type public.rental_status as enum
    ('requested','confirmed','declined','picked_up','returned','completed','cancelled','no_show');
exception when duplicate_object then null; end $$;

-- One row = one physically distinct vehicle. A fleet of five identical Picantos
-- is five rows, because the exclusion constraint's grain is the vehicle: the
-- promise being made is "this car is yours on these days", and it cannot be
-- made about a model.
create table if not exists public.rental_vehicles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,                    -- "Kia Picanto 2021"
  name_en text,
  description text,
  vehicle_type text,                     -- sedan | suv | van | pickup | bike…
  transmission text,                     -- automatic | manual
  fuel text,                             -- petrol | diesel | hybrid | electric
  seats int not null default 5 check (seats between 1 and 60),
  model_year int check (model_year between 1950 and 2100),
  base_daily_price numeric not null default 0 check (base_daily_price >= 0),
  weekend_price numeric check (weekend_price >= 0),   -- Fri/Sat; null = base
  min_days int not null default 1 check (min_days between 1 and 365),
  delivery_fee numeric not null default 0 check (delivery_fee >= 0),
  -- Stated by the merchant, collected by the merchant, in cash, at pickup.
  -- Matjar never holds it. Never added to grand_total.
  deposit_amount numeric not null default 0 check (deposit_amount >= 0),
  min_driver_age int not null default 18 check (min_driver_age between 16 and 99),
  daily_km_limit int check (daily_km_limit > 0),      -- null = unlimited
  extra_km_price numeric not null default 0 check (extra_km_price >= 0),
  insurance_included boolean not null default false,
  insurance_note text,
  pickup_location text,
  pickup_time text,
  return_time text,
  cancellation_policy text,
  features jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rental_vehicles_store_idx
  on public.rental_vehicles (store_id, sort_order);

create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  vehicle_id uuid not null references public.rental_vehicles(id) on delete cascade,
  customer_id uuid references auth.users(id) on delete set null,
  renter_name text not null,
  phone text not null,
  pickup_date date not null,
  return_date date not null,
  days int not null,
  driver_age int not null,
  base_total numeric not null default 0,
  delivery_fee numeric not null default 0,
  -- Snapshot of what the merchant said at the time of booking, so a later edit
  -- to the vehicle cannot rewrite the terms a customer already agreed to.
  deposit_amount numeric not null default 0,
  daily_km_limit int,
  extra_km_price numeric not null default 0,
  insurance_included boolean not null default false,
  -- base_total + delivery_fee. The deposit is NOT in here; see the header.
  grand_total numeric not null default 0,
  notes text,
  status public.rental_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_valid_range check (return_date > pickup_date)
);
create index if not exists rental_bookings_store_idx
  on public.rental_bookings (store_id, pickup_date);
create index if not exists rental_bookings_vehicle_idx
  on public.rental_bookings (vehicle_id, pickup_date);

-- THE DOUBLE-BOOKING GUARD. Two customers holding the same car on the same
-- weekend is the failure that ends a merchant's trust in the platform, so it is
-- refused by the storage engine rather than by a check the application might
-- forget to run. Terminal statuses (declined/cancelled/returned/completed/
-- no_show) release the range so the car can be re-let.
alter table public.rental_bookings drop constraint if exists rental_no_overlap;
alter table public.rental_bookings add constraint rental_no_overlap
  exclude using gist (
    vehicle_id with =,
    daterange(pickup_date, return_date, '[)') with &&
  ) where (status in ('requested','confirmed','picked_up'));

alter table public.rental_vehicles enable row level security;
alter table public.rental_bookings enable row level security;

-- Fleet: the storefront reads active vehicles; the fleet is written by whoever
-- holds the `products` permission (post-0159 predicate — see the header).
drop policy if exists rental_vehicles_public_read on public.rental_vehicles;
create policy rental_vehicles_public_read on public.rental_vehicles for select
  using (active = true or public.staff_can(store_id, 'products'));
drop policy if exists rental_vehicles_manage on public.rental_vehicles;
create policy rental_vehicles_manage on public.rental_vehicles for all
  using (public.staff_can(store_id, 'products'))
  with check (public.staff_can(store_id, 'products'));

-- Bookings: whoever holds `bookings` sees and works the store's; a signed-in
-- customer sees their own. There is deliberately NO insert policy — every
-- booking goes through place_rental_booking(), which is where the server-side
-- pricing, the age check, the rate limit and the overlap translation live. A
-- direct insert would bypass all four.
drop policy if exists rental_bookings_select on public.rental_bookings;
create policy rental_bookings_select on public.rental_bookings for select
  using (public.staff_can(store_id, 'bookings') or customer_id = auth.uid());
drop policy if exists rental_bookings_update_store on public.rental_bookings;
create policy rental_bookings_update_store on public.rental_bookings for update
  using (public.staff_can(store_id, 'bookings'))
  with check (public.staff_can(store_id, 'bookings'));

-- Table privileges. Supabase's default ACL on a new public table hands anon and
-- authenticated FULL DML and leaves RLS as the only thing standing (verified:
-- a table created here comes out `anon=arwdDxtm`). RLS IS holding — there is no
-- insert policy on either table and no delete policy on the bookings — but a
-- privilege that is never meant to be exercised is better removed than merely
-- unreachable, and these are brand-new objects, so no deployed code can be
-- reading a grant I take away (0258's lesson, from the wrong direction).
revoke insert, update, delete on public.rental_vehicles from anon;
revoke insert, update, delete on public.rental_bookings from anon;
-- A booking is created ONLY by place_rental_booking() and removed by nobody:
-- a rental that stops existing is a rental the merchant cannot be held to.
-- Cancelling sets a status, which is what update_rental_status() does.
revoke insert, delete on public.rental_bookings from authenticated;

-- Per-day price sum over [pickup, return): Fri (5) and Sat (6) take the weekend
-- rate when the merchant set one, else the base rate. Deliberately the same
-- shape and the same dow numbers as stay_base_total(), so the two read as one
-- idea. search_path pinned to '' per 0285/0290.
create or replace function public.rental_base_total(
  p_vehicle public.rental_vehicles, p_pickup date, p_return date
) returns numeric language sql immutable set search_path = '' as $$
  select coalesce(sum(
    case when extract(dow from d) in (5, 6)
         then coalesce(p_vehicle.weekend_price, p_vehicle.base_daily_price)
         else p_vehicle.base_daily_price end), 0)
  from generate_series(p_pickup, p_return - 1, interval '1 day') d;
$$;

-- Available vehicles for a day range + the stated driver age, priced.
-- `deposit` is returned so the storefront can SHOW it; it is not in grand_total.
create or replace function public.search_rentals(
  p_store_id uuid, p_pickup date, p_return date, p_driver_age int
) returns table (
  vehicle_id uuid, name text, name_en text, vehicle_type text,
  transmission text, fuel text, seats int, model_year int, images jsonb,
  features jsonb, days int, base_total numeric, delivery_fee numeric,
  deposit numeric, grand_total numeric, min_days int, min_driver_age int,
  daily_km_limit int, extra_km_price numeric, insurance_included boolean,
  insurance_note text, pickup_location text, pickup_time text, return_time text
) language plpgsql security definer set search_path = '' as $$
declare v_days int;
begin
  if p_return <= p_pickup or p_pickup < current_date then
    raise exception 'invalid_range';
  end if;
  v_days := p_return - p_pickup;
  return query
  select v.id, v.name, v.name_en, v.vehicle_type, v.transmission, v.fuel,
         v.seats, v.model_year, v.images, v.features, v_days,
         public.rental_base_total(v, p_pickup, p_return) as base_total,
         v.delivery_fee, v.deposit_amount,
         public.rental_base_total(v, p_pickup, p_return) + v.delivery_fee as grand_total,
         v.min_days, v.min_driver_age, v.daily_km_limit, v.extra_km_price,
         v.insurance_included, v.insurance_note, v.pickup_location,
         v.pickup_time, v.return_time
  from public.rental_vehicles v
  where v.store_id = p_store_id and v.active
    and v_days >= v.min_days
    -- A car the caller is too young to drive is not "available" to them.
    -- Filtered here as well as refused in place_rental_booking(), so nobody is
    -- shown a price they will then be told they cannot have.
    and (p_driver_age is null or p_driver_age >= v.min_driver_age)
    and not exists (
      select 1 from public.rental_bookings b
      where b.vehicle_id = v.id
        and b.status in ('requested','confirmed','picked_up')
        and daterange(b.pickup_date, b.return_date, '[)')
            && daterange(p_pickup, p_return, '[)'))
  order by grand_total;
end; $$;

-- Create a rental request. Guest-capable (the storefront takes bookings without
-- an account, same as the stay engine), server-priced, atomic against the
-- exclusion constraint, and it notifies the owner.
create or replace function public.place_rental_booking(
  p_vehicle_id uuid, p_pickup date, p_return date, p_driver_age int,
  p_name text, p_phone text, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_vehicle public.rental_vehicles;
  v_id uuid; v_owner uuid; v_store_name text;
  v_days int; v_base numeric;
  v_uid uuid := auth.uid();
begin
  if coalesce(trim(p_name),'')='' or coalesce(trim(p_phone),'')='' then
    raise exception 'missing_fields';
  end if;
  if p_return <= p_pickup or p_pickup < current_date then
    raise exception 'invalid_range';
  end if;
  -- Abuse guard, copied from 0196's fix to place_stay_booking and needed for
  -- exactly the same reason: the exclusion constraint means an unpaid request
  -- BLOCKS the vehicle, so without a cap one anonymous caller could take a
  -- merchant's whole fleet off the market for nothing.
  if (select count(*) from public.rental_bookings
      where phone = trim(p_phone) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  select * into v_vehicle from public.rental_vehicles where id = p_vehicle_id and active;
  if v_vehicle.id is null then raise exception 'vehicle_not_found'; end if;

  v_days := p_return - p_pickup;
  if v_days < v_vehicle.min_days then raise exception 'min_days'; end if;
  if coalesce(p_driver_age, 0) < v_vehicle.min_driver_age then
    raise exception 'driver_too_young';
  end if;

  select owner_id, name into v_owner, v_store_name
    from public.stores where id = v_vehicle.store_id;
  v_base := public.rental_base_total(v_vehicle, p_pickup, p_return);

  begin
    insert into public.rental_bookings (
      store_id, vehicle_id, customer_id, renter_name, phone, pickup_date,
      return_date, days, driver_age, base_total, delivery_fee, deposit_amount,
      daily_km_limit, extra_km_price, insurance_included, grand_total, notes)
    values (
      v_vehicle.store_id, p_vehicle_id, v_uid, trim(p_name), trim(p_phone),
      p_pickup, p_return, v_days, p_driver_age,
      v_base, v_vehicle.delivery_fee, v_vehicle.deposit_amount,
      v_vehicle.daily_km_limit, v_vehicle.extra_km_price,
      v_vehicle.insurance_included,
      -- deposit deliberately absent from the total: Matjar holds no money.
      v_base + v_vehicle.delivery_fee,
      nullif(trim(coalesce(p_notes,'')),''))
    returning id into v_id;
  exception when exclusion_violation then
    -- The constraint, not a race we tried to win in application code.
    raise exception 'dates_taken';
  end;

  insert into public.notifications (user_id, type, data)
  values (v_owner, 'rental_new', jsonb_build_object(
    'rental_id', v_id, 'store_id', v_vehicle.store_id, 'store_name', v_store_name,
    'vehicle_name', v_vehicle.name, 'pickup_date', p_pickup, 'return_date', p_return));

  return v_id;
end; $$;

-- Manager moves a rental along its lifecycle.
create or replace function public.update_rental_status(
  p_id uuid, p_status public.rental_status
) returns void language plpgsql security definer set search_path = '' as $$
declare v_store uuid;
begin
  select store_id into v_store from public.rental_bookings where id = p_id;
  if v_store is null then raise exception 'not_found'; end if;
  if not public.staff_can(v_store, 'bookings') then raise exception 'forbidden'; end if;
  update public.rental_bookings set status = p_status, updated_at = now() where id = p_id;
end; $$;

-- Audience stated, per 0281/0284. The two storefront RPCs are called without a
-- session by design (a visitor books a car the way a visitor books a room);
-- the status control is merchant-side and never anonymous.
revoke all on function public.rental_base_total(public.rental_vehicles, date, date)
  from public, anon, authenticated;
revoke all on function public.search_rentals(uuid, date, date, int)
  from public, anon, authenticated;
grant execute on function public.search_rentals(uuid, date, date, int)
  to anon, authenticated;
revoke all on function public.place_rental_booking(uuid, date, date, int, text, text, text)
  from public, anon, authenticated;
grant execute on function public.place_rental_booking(uuid, date, date, int, text, text, text)
  to anon, authenticated;
revoke all on function public.update_rental_status(uuid, public.rental_status)
  from public, anon, authenticated;
grant execute on function public.update_rental_status(uuid, public.rental_status)
  to authenticated;

-- ---------------------------------------------------------------------------
-- THE OVERLAP PROOF
-- ---------------------------------------------------------------------------
-- Run against production inside `begin; … rollback;` before this file was
-- applied, with fixtures seeded in the same transaction. Two vehicles on one
-- store; car A holds a CONFIRMED rental 2026-09-04 → 2026-09-07. Verbatim:
--
--   A. same range, same car        refused 23P01 conflicting key value violates
--                                  exclusion constraint "rental_no_overlap"
--   B. strictly inside it          refused 23P01 … "rental_no_overlap"
--   C. straddling the start        refused 23P01 … "rental_no_overlap"
--   D. same range, OTHER car       inserted  ← positive control. Without it a
--                                  constraint that refused everything would
--                                  look identical to one that works.
--   E. back-to-back 09-07 → 09-09  inserted  ← the half-open bound
--   F. blocker set to 'cancelled',
--      then A retried              inserted  ← a terminal status frees the car
--   G. place_rental_booking() over
--      the held range              refused P0001 dates_taken  ← the RPC
--                                  translates the constraint rather than
--                                  leaking a raw 23P01 at the customer
--   H. pickup_date = return_date   refused 23514 … violates check constraint
--                                  "rental_valid_range"  ← the check that stops
--                                  an EMPTY daterange sliding past the
--                                  exclusion constraint entirely
--   I. driver aged 19 on a car
--      with min_driver_age 21      refused P0001 driver_too_young
--
-- Pricing, same transaction: Fri 09-04 + Sat 09-05 at the 40 weekend rate and
-- Sun 09-06 at the 30 base = base 110; grand_total 115 (delivery 5); deposit
-- 200 reported SEPARATELY and absent from the total.
--
-- search_rentals(): over the held range it returned only car B; over a free
-- range it returned both; with a 19-year-old driver it returned only the car
-- with no age minimum.
--
-- RLS, with `set local role authenticated` / `anon` and jwt claims:
--   authenticated stranger  2 vehicles (the active ones), 0 bookings
--   store owner             3 vehicles (inactive included), 1 booking
--   anon                    2 vehicles, 0 bookings
--   owner inserting a vehicle          inserted
--   stranger inserting a vehicle       refused 42501 new row violates
--                                      row-level security policy
--   anon inserting a vehicle           refused 42501 permission denied
--   owner inserting a booking DIRECT   refused 42501 permission denied for
--                                      table rental_bookings — i.e. every
--                                      booking really does have to go through
--                                      place_rental_booking()
--
-- NOT PROVEN HERE: a staff member holding exactly `bookings` or exactly
-- `products` (no staff fixture was seeded). Those belong in
-- supabase/tests/rls_policy_matrix.test.sql; the cases are listed in the
-- handover for MJ-003.
-- ---------------------------------------------------------------------------
