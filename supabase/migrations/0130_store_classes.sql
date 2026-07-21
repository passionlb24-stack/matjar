-- Weekly recurring group classes (gym sessions, group courses). Each class runs on
-- a fixed weekday + start time with a fixed capacity. The public storefront shows
-- the next occurrence of each class and books a capacity-limited spot, reusing the
-- shared `bookings` table via a new class_id FK. class_spots_taken() counts live
-- bookings for a class on a given date so the picker can show spots-left and the
-- booking path can re-check capacity before inserting.
-- Applied to production via Supabase migration `store_classes`.

create table public.store_classes (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  name         text not null,
  name_en      text,
  description  text,
  day_of_week  integer not null default 1,       -- 0=Sun .. 6=Sat (JS getDay)
  start_time   text not null default '18:00',
  capacity     integer not null default 10,
  price        numeric,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index store_classes_store_idx on public.store_classes (store_id);

alter table public.store_classes enable row level security;

create policy store_classes_public_read on public.store_classes
  for select using (true);

create policy store_classes_manage on public.store_classes
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));

-- Link bookings to a class (null = ordinary booking, unchanged).
alter table public.bookings
  add column class_id uuid references public.store_classes (id) on delete set null;

-- Spots already taken for a class on a given date (drives spots-left + capacity
-- re-check before insert).
create or replace function public.class_spots_taken(p_class_id uuid, p_date date)
returns integer
language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from bookings
  where class_id = p_class_id
    and requested_date = p_date
    and status::text not in ('cancelled', 'rejected', 'declined', 'no_show');
$$;
