-- Multiple branches (locations). Today a store is a single physical place; this
-- lets one business run several branches, each with its own address, contact,
-- and coordinates. Stock stays shared at the product level (a deliberate v1
-- choice); what branches add is: where each order/sale happened + accurate
-- "nearest branch" discovery. Backwards-compatible: every existing store gets
-- one primary branch backfilled from its current fields, so nothing changes for
-- single-location stores.

create table public.store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text,               -- branch label e.g. "فرع الحمرا"; blank for the sole branch
  address text,
  region text,
  area text,
  phone text,
  whatsapp text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_locations_store_idx on public.store_locations (store_id);
create index store_locations_geo_idx on public.store_locations (lat, lng);

create trigger store_locations_set_updated_at
  before update on public.store_locations
  for each row execute function public.set_updated_at();

alter table public.store_locations enable row level security;

-- Read: anyone can see active branches of a live store (needed for discovery +
-- the public store page); managers and admins see all their branches.
create policy store_locations_select on public.store_locations for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.status = 'active' and s.deleted_at is null
    )
    or public.can_manage_store(store_id)
    or public.is_super_admin()
  );

-- Write: only whoever manages the store. (Direct writes, RLS-guarded — same
-- model as the store-settings edits; simple owner/staff authority.)
create policy store_locations_insert on public.store_locations for insert
  with check (public.can_manage_store(store_id));
create policy store_locations_update on public.store_locations for update
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
create policy store_locations_delete on public.store_locations for delete
  using (public.can_manage_store(store_id));

-- Backfill: one primary branch per existing (non-deleted) store, copied from the
-- store's current location fields.
insert into public.store_locations
  (store_id, name, address, region, area, phone, whatsapp, lat, lng, is_primary, is_active)
select id, null, address, region, area, phone, whatsapp, lat, lng, true, true
from public.stores
where deleted_at is null;
