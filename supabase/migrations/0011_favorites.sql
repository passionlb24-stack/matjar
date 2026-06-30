-- Section 2 — customer favorite stores.
create table public.favorites (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, store_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = customer_id);

create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = customer_id);

create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = customer_id);
