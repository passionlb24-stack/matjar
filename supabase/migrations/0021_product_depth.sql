-- Product depth: multi-image gallery, stock, variants (size/color with own
-- price/stock) and options (paid add-ons / extras).
alter table public.products
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists stock integer; -- null = stock not tracked

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  price numeric(12,2),          -- null => inherit product price
  stock integer,                -- null => not tracked
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_variants_product_id_idx
  on public.product_variants(product_id);

create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_options_product_id_idx
  on public.product_options(product_id);

alter table public.product_variants enable row level security;
alter table public.product_options enable row level security;

-- A row is readable when its parent product is readable (products RLS already
-- enforces active-product + active-store for the public, own products for the
-- owner, and everything for admins) -> one select policy covers all readers.
create policy product_variants_select on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id)
  );
create policy product_options_select on public.product_options
  for select using (
    exists (select 1 from public.products p where p.id = product_id)
  );

-- Writes require the caller to manage the owning store.
create policy product_variants_insert on public.product_variants
  for insert to authenticated with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  );
create policy product_variants_update on public.product_variants
  for update to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  );
create policy product_variants_delete on public.product_variants
  for delete to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  );

create policy product_options_insert on public.product_options
  for insert to authenticated with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  );
create policy product_options_update on public.product_options
  for update to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  );
create policy product_options_delete on public.product_options
  for delete to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_id and public.can_manage_store(p.store_id))
  );
