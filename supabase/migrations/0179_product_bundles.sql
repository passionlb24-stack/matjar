-- 0179: product bundles. A bundle is a normal product row (is_bundle = true)
-- with its own name/price/image/stock, so it flows through cart + checkout with
-- ZERO change to the order RPCs. bundle_items lists the component products for
-- display only ("includes: 2× X, 1× Y") and to compute savings vs buying apart.

alter table public.products
  add column if not exists is_bundle boolean not null default false;

create table if not exists public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  sort_order integer not null default 0
);

create index if not exists bundle_items_bundle on public.bundle_items (bundle_id);

alter table public.bundle_items enable row level security;

-- Anyone who can see the bundle product can see its contents; only the store
-- team writes them. Both checks hop through the parent product's store.
drop policy if exists bundle_items_select on public.bundle_items;
create policy bundle_items_select on public.bundle_items
  for select using (
    exists (
      select 1 from public.products p
      where p.id = bundle_items.bundle_id
        and (p.status = 'active' and p.deleted_at is null
             or public.can_manage_store(p.store_id))
    )
  );

drop policy if exists bundle_items_write on public.bundle_items;
create policy bundle_items_write on public.bundle_items
  for all using (
    exists (
      select 1 from public.products p
      where p.id = bundle_items.bundle_id
        and public.can_manage_store(p.store_id)
    )
  ) with check (
    exists (
      select 1 from public.products p
      where p.id = bundle_items.bundle_id
        and public.can_manage_store(p.store_id)
    )
  );
