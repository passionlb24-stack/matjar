-- 0235: the taxonomy and the coverage map behind the crafts directory.
--
-- Matjar already had almost all of this section. The `contractors` sector
-- ("مقاولات وحرفيّون") exists, and its config already grants exactly the right
-- feature set — requests, portfolio, verifications, reviews, location,
-- messaging. A store in it gets a profile, services as products, a gallery,
-- reviews, hours, phone and WhatsApp, quote-and-counter-quote service requests
-- and a full dashboard. None of that needed building.
--
-- Three things were genuinely missing, and this migration is those three.
--
-- 1. The taxonomy was one level too coarse. A store is "contracting", but
--    nobody searches for contracting — they search for a كهربجي. `trades` is
--    the level people actually name, and `synonyms` is what lets the words they
--    type reach it without a search engine.
--
-- 2. Coverage. Every other store on this platform has one address and that is
--    the whole story. A plumber has a catchment: Tripoli, El Mina, Qalamoun.
--    store_service_areas is the single biggest structural difference between
--    this section and the rest of the marketplace.
--
-- 3. Areas. The five existing regions stay untouched — "الشمال" is simply not
--    an answer to "where?" when the customer means طرابلس, so lb_areas adds the
--    level underneath rather than replacing the one above.
--
-- Reference data is world-readable and admin-written. The two link tables are
-- public to read (they are what the directory shows) and written by whoever can
-- manage the store.

create table if not exists public.trade_groups (
  slug       text primary key,
  name_ar    text not null,
  name_en    text not null,
  icon       text,
  sort_order int  not null default 0,
  active     boolean not null default true
);

create table if not exists public.trades (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  group_slug text not null references public.trade_groups(slug) on delete restrict,
  name_ar    text not null,
  name_en    text not null,
  synonyms   text[] not null default '{}',
  icon       text,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists trades_group_idx on public.trades (group_slug, sort_order);

create table if not exists public.lb_areas (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  region     text not null,
  name_ar    text not null,
  name_en    text not null,
  sort_order int not null default 0
);
create index if not exists lb_areas_region_idx on public.lb_areas (region, sort_order);

create table if not exists public.store_trades (
  store_id uuid not null references public.stores(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  primary key (store_id, trade_id)
);
create index if not exists store_trades_trade_idx on public.store_trades (trade_id);

create table if not exists public.store_service_areas (
  store_id uuid not null references public.stores(id) on delete cascade,
  area_id  uuid not null references public.lb_areas(id) on delete cascade,
  primary key (store_id, area_id)
);
create index if not exists store_service_areas_area_idx
  on public.store_service_areas (area_id);

alter table public.trade_groups        enable row level security;
alter table public.trades              enable row level security;
alter table public.lb_areas            enable row level security;
alter table public.store_trades        enable row level security;
alter table public.store_service_areas enable row level security;

drop policy if exists trade_groups_read on public.trade_groups;
create policy trade_groups_read on public.trade_groups for select using (active);
drop policy if exists trade_groups_admin on public.trade_groups;
create policy trade_groups_admin on public.trade_groups for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades for select using (active);
drop policy if exists trades_admin on public.trades;
create policy trades_admin on public.trades for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists lb_areas_read on public.lb_areas;
create policy lb_areas_read on public.lb_areas for select using (true);
drop policy if exists lb_areas_admin on public.lb_areas;
create policy lb_areas_admin on public.lb_areas for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists store_trades_read on public.store_trades;
create policy store_trades_read on public.store_trades for select using (true);
drop policy if exists store_trades_manage on public.store_trades;
create policy store_trades_manage on public.store_trades for all
  using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());

drop policy if exists store_service_areas_read on public.store_service_areas;
create policy store_service_areas_read on public.store_service_areas for select using (true);
drop policy if exists store_service_areas_manage on public.store_service_areas;
create policy store_service_areas_manage on public.store_service_areas for all
  using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());
