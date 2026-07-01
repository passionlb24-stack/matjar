-- Sunday Market — admin-managed regions. Seeded with the 5 Lebanon
-- governorate keys so existing listings (which store the region key) stay
-- aligned; the admin can rename, reorder, deactivate, or add regions for the
-- market. `key` is the stable identifier stored on listings; store/explore
-- pages keep using the platform-wide catalog regions.
create table public.market_regions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.market_regions enable row level security;

create policy "market_regions_select_active"
  on public.market_regions for select
  using (is_active or public.is_super_admin());

create policy "market_regions_admin_write"
  on public.market_regions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.market_regions (key, name_ar, name_en, sort_order) values
  ('beirut', 'بيروت', 'Beirut', 0),
  ('mountLebanon', 'جبل لبنان', 'Mount Lebanon', 1),
  ('north', 'الشمال', 'North', 2),
  ('south', 'الجنوب', 'South', 3),
  ('bekaa', 'البقاع', 'Bekaa', 4);
