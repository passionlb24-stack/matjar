-- Phase 3 — service bookings / appointment requests.
create type booking_status as enum (
  'pending', 'accepted', 'scheduled', 'completed', 'cancelled', 'rejected'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id),
  service_name text,
  requested_date date,
  requested_time text,
  customer_name text,
  phone text,
  notes text,
  status booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_store_id_idx on public.bookings (store_id);
create index bookings_customer_id_idx on public.bookings (customer_id);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

create policy "bookings_select_customer"
  on public.bookings for select
  using (auth.uid() = customer_id);

create policy "bookings_select_store"
  on public.bookings for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = bookings.store_id and s.owner_id = auth.uid()
    )
  );

create policy "bookings_select_admin"
  on public.bookings for select
  using (public.is_super_admin());

create policy "bookings_insert_customer"
  on public.bookings for insert
  with check (auth.uid() = customer_id);

create policy "bookings_update_store"
  on public.bookings for update
  using (
    exists (
      select 1 from public.stores s
      where s.id = bookings.store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = bookings.store_id and s.owner_id = auth.uid()
    )
  );
