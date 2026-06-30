-- Healthcare module specifics (PRD 3.4): a doctors roster per store, plus
-- store-level specialties and accepted-insurance notes. (Lab "tests" are just
-- priced services in the existing products list, so no new table for those.)
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  specialty text,
  photo_url text,
  bio text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists doctors_store_id_idx on public.doctors(store_id);

alter table public.stores
  add column if not exists specialties text,
  add column if not exists insurance text;

alter table public.doctors enable row level security;

-- Public reads doctors of active stores; managers see/manage their own; admins all.
create policy doctors_select on public.doctors
  for select using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.status = 'active' and s.deleted_at is null
    )
    or public.can_manage_store(store_id)
    or public.is_super_admin()
  );
create policy doctors_insert on public.doctors
  for insert to authenticated with check (public.can_manage_store(store_id));
create policy doctors_update on public.doctors
  for update to authenticated using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
create policy doctors_delete on public.doctors
  for delete to authenticated using (public.can_manage_store(store_id));
