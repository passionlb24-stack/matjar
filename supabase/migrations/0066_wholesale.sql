-- Wholesale B2B vertical. Wholesalers list bulk goods with a minimum order
-- quantity (MOQ) and tiered pricing (buy more → pay less per unit). Retailers
-- browse and contact the seller via in-app messaging (0061). No payment.

create table if not exists public.wholesale_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  seller_name text,   -- denormalized (profiles RLS is own-only)
  title text not null,
  description text not null,
  category text,
  image_url text,
  unit text,          -- carton / dozen / kg …
  moq int,            -- minimum order quantity
  price numeric(12, 2), -- price per unit (starting)
  tiers jsonb not null default '[]'::jsonb, -- [{ "qty": int, "price": number }]
  region text,
  status text not null default 'active', -- active | paused
  created_at timestamptz not null default now()
);
create index if not exists wholesale_active_idx
  on public.wholesale_products (status, created_at desc);
create index if not exists wholesale_seller_idx
  on public.wholesale_products (seller_id);

alter table public.wholesale_products enable row level security;

drop policy if exists wholesale_select on public.wholesale_products;
create policy wholesale_select on public.wholesale_products
  for select to public
  using (status = 'active' or seller_id = (select auth.uid()));
drop policy if exists wholesale_insert on public.wholesale_products;
create policy wholesale_insert on public.wholesale_products
  for insert to authenticated with check (seller_id = (select auth.uid()));
drop policy if exists wholesale_update on public.wholesale_products;
create policy wholesale_update on public.wholesale_products
  for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
drop policy if exists wholesale_delete on public.wholesale_products;
create policy wholesale_delete on public.wholesale_products
  for delete to authenticated using (seller_id = (select auth.uid()));
