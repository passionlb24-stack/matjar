-- Per-store feature-module overrides. Each sector ships a default bundle of
-- enabled modules (SectorConfig.features in src/lib/sectors.ts); this table lets
-- a store toggle an individual module on or off on top of that default. The
-- resolved set (resolveStoreModules(category, overrides)) gates public surfaces
-- (map, certifications, time-slot booking, memberships, classes, …). Absence of a
-- row means "use the sector default"; a row pins enabled true/false explicitly.
-- Applied to production via Supabase migration `store_modules`.

create table public.store_modules (
  store_id    uuid not null references public.stores (id) on delete cascade,
  module_key  text not null,
  enabled     boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (store_id, module_key)
);

alter table public.store_modules enable row level security;

-- Public read so the storefront can resolve which modules to render; only the
-- store's managers can change the toggles.
create policy store_modules_public_read on public.store_modules
  for select using (true);

create policy store_modules_manage on public.store_modules
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));
