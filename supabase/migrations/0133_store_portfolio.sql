-- Portfolio / past-work gallery for service & contractor sectors: a public
-- proof-of-work grid (image + title + optional link). Gated by the "portfolio"
-- feature module. Public read; store managers CRUD their own.
-- Applied to production via Supabase migration `store_portfolio`.

create table public.store_portfolio (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  title       text not null,
  title_en    text,
  description text,
  image_url   text,
  link        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index store_portfolio_store_idx on public.store_portfolio (store_id);

alter table public.store_portfolio enable row level security;
create policy store_portfolio_public_read on public.store_portfolio
  for select using (true);
create policy store_portfolio_manage on public.store_portfolio
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));
