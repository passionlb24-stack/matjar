-- Sector-adaptive storefront SECTIONS. A store can group its catalog into named
-- sections so the storefront opens according to its type: a food store reads
-- like a menu ("Appetizers", "Main dishes", "Drinks"), retail like collections,
-- a clinic like service groups, etc. The merchant defines the sections and
-- assigns products to them; the public store page renders products grouped by
-- section. Fully optional and backwards-compatible: a store with no sections
-- renders one flat list exactly as before, and an unsectioned product falls
-- into a generic "Other" group.

create table public.store_sections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,          -- section title e.g. "المقبلات" / "Appetizers"
  name_en text,                -- optional English override (localized() picks it)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index store_sections_store_idx on public.store_sections (store_id, sort_order);

-- Products belong to at most one section. Nullable on purpose: unsectioned
-- products render under the default "Other" group. If a section is removed its
-- products are un-assigned (set null), never deleted.
alter table public.products
  add column if not exists section_id uuid references public.store_sections (id) on delete set null;

alter table public.store_sections enable row level security;

-- Read: anyone can see the sections of a live store (needed for the public
-- storefront grouping); managers and admins see all their sections.
create policy store_sections_select on public.store_sections for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.status = 'active' and s.deleted_at is null
    )
    or public.can_manage_store(store_id)
    or public.is_super_admin()
  );

-- Write: only whoever manages the store. Direct writes, RLS-guarded — same
-- model as store_locations (migration 0084).
create policy store_sections_insert on public.store_sections for insert
  with check (public.can_manage_store(store_id));
create policy store_sections_update on public.store_sections for update
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
create policy store_sections_delete on public.store_sections for delete
  using (public.can_manage_store(store_id));
