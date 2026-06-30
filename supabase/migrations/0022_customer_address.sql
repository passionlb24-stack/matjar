-- A saved detailed delivery address per customer (one default row per user),
-- editable from the account page and used to prefill checkout.
create table if not exists public.addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  region text,
  city text,
  street text,
  building text,
  floor text,
  details text,
  phone text,
  updated_at timestamptz not null default now()
);

alter table public.addresses enable row level security;

create policy addresses_select_own on public.addresses
  for select to authenticated using (user_id = auth.uid());
create policy addresses_insert_own on public.addresses
  for insert to authenticated with check (user_id = auth.uid());
create policy addresses_update_own on public.addresses
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
