-- Bookable resources for the time-slot booking family (courts, rooms, rental
-- items, salon chairs). A resource has its own daily open/close window; customers
-- pick a resource → date → free hour slot. Bookings reuse the shared `bookings`
-- table via a new resource_id FK, and resource_booked_times() returns the hours
-- already taken for a given resource+date so the public picker can grey them out.
-- Applied to production via Supabase migration `store_resources_timeslot`.

create table public.store_resources (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,
  name_en     text,
  price       numeric,
  open_hour   integer not null default 8,
  close_hour  integer not null default 24,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index store_resources_store_idx on public.store_resources (store_id);

alter table public.store_resources enable row level security;

create policy store_resources_public_read on public.store_resources
  for select using (true);

create policy store_resources_manage on public.store_resources
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));

-- Link bookings to a resource (null = ordinary store/doctor booking, unchanged).
alter table public.bookings
  add column resource_id uuid references public.store_resources (id) on delete set null;

-- Hours already taken for a resource on a date (drives the public slot picker).
create or replace function public.resource_booked_times(p_resource_id uuid, p_date date)
returns setof text
language sql stable security definer set search_path to 'public' as $$
  select requested_time from bookings
  where resource_id = p_resource_id
    and requested_date = p_date
    and requested_time is not null
    and status::text not in ('cancelled', 'rejected', 'declined', 'no_show');
$$;
