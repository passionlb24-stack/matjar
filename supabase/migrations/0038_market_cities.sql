-- Sunday Market — admin-managed cities. Regions stay the fixed 5 Lebanon
-- governorates (used platform-wide); cities are the long, volatile list, so
-- they live in a table the admin can grow. `region` holds a fixed region key.
create table public.market_cities (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  name_ar text not null,
  name_en text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index market_cities_region_idx on public.market_cities (region, sort_order);

alter table public.market_cities enable row level security;

create policy "market_cities_select_active"
  on public.market_cities for select
  using (is_active or public.is_super_admin());

create policy "market_cities_admin_write"
  on public.market_cities for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Seed a starter set of major cities per region (admin can extend).
insert into public.market_cities (region, name_ar, name_en, sort_order) values
  ('beirut', 'بيروت', 'Beirut', 0),
  ('beirut', 'الأشرفية', 'Achrafieh', 1),
  ('beirut', 'الحمرا', 'Hamra', 2),
  ('mountLebanon', 'جونية', 'Jounieh', 0),
  ('mountLebanon', 'جبيل', 'Byblos', 1),
  ('mountLebanon', 'بعبدا', 'Baabda', 2),
  ('mountLebanon', 'بعبدات', 'Baabdat', 3),
  ('mountLebanon', 'عاليه', 'Aley', 4),
  ('north', 'طرابلس', 'Tripoli', 0),
  ('north', 'زغرتا', 'Zgharta', 1),
  ('north', 'بشري', 'Bcharre', 2),
  ('north', 'الكورة', 'Koura', 3),
  ('south', 'صيدا', 'Saida', 0),
  ('south', 'صور', 'Tyre', 1),
  ('south', 'النبطية', 'Nabatieh', 2),
  ('bekaa', 'زحلة', 'Zahle', 0),
  ('bekaa', 'بعلبك', 'Baalbek', 1),
  ('bekaa', 'شتورة', 'Chtoura', 2);
