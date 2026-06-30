-- Phase 2 — products belonging to a store.

create type product_status as enum ('active', 'draft', 'hidden');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  discount_price numeric(12, 2),
  image_url text,
  is_available boolean not null default true,
  status product_status not null default 'active',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index products_store_id_idx on public.products (store_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "products_select_public"
  on public.products for select
  using (
    status = 'active'
    and deleted_at is null
    and exists (
      select 1 from public.stores s
      where s.id = products.store_id
        and s.status = 'active'
        and s.deleted_at is null
    )
  );

create policy "products_select_own"
  on public.products for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.owner_id = auth.uid()
    )
  );

create policy "products_insert_own"
  on public.products for insert
  with check (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.owner_id = auth.uid()
    )
  );

create policy "products_update_own"
  on public.products for update
  using (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.owner_id = auth.uid()
    )
  );

create policy "products_select_admin"
  on public.products for select
  using (public.is_super_admin());
