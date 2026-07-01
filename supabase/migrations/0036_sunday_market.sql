-- سوق الأحد (Sunday Market): a unified listings system inside Matjar. Any
-- registered user (regular or merchant) posts in the SAME table; store_id is set
-- only for merchants (drives the "تاجر / visit store" identity).

create table if not exists public.market_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.market_categories (slug, name_ar, name_en, sort_order) values
  ('phones','هواتف','Phones',1),
  ('computers','كمبيوتر','Computers',2),
  ('laptops','لابتوبات','Laptops',3),
  ('gaming','ألعاب','Gaming',4),
  ('furniture','أثاث','Furniture',5),
  ('cars','سيارات','Cars',6),
  ('bikes','دراجات','Bikes',7),
  ('clothing','ملابس','Clothing',8),
  ('shoes','أحذية','Shoes',9),
  ('watches','ساعات','Watches',10),
  ('appliances','أجهزة كهربائية','Appliances',11),
  ('kitchen','مطبخ','Kitchen',12),
  ('kids','أطفال','Kids',13),
  ('books','كتب','Books',14),
  ('sports','معدات رياضية','Sports',15),
  ('cameras','كاميرات','Cameras',16),
  ('music','آلات موسيقية','Music',17),
  ('professional','معدات مهنية','Professional',18),
  ('garden','حدائق','Garden',19),
  ('other','أخرى','Other',99)
on conflict (slug) do nothing;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  category_id uuid references public.market_categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(12,2),
  city text,
  region text,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','pending','active','sold','rejected')),
  is_featured boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_category_id_idx on public.listings(category_id);
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists listings_store_id_idx on public.listings(store_id);

create table if not exists public.listing_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists listing_favorites_listing_id_idx on public.listing_favorites(listing_id);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewed')),
  created_at timestamptz not null default now()
);
create index if not exists listing_reports_listing_id_idx on public.listing_reports(listing_id);

alter table public.products
  add column if not exists in_offers boolean not null default false,
  add column if not exists in_clearance boolean not null default false;

alter table public.market_categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.listing_reports enable row level security;

create policy market_categories_select on public.market_categories
  for select using (is_active or public.is_super_admin());
create policy market_categories_write_admin on public.market_categories
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

create policy listings_select_public on public.listings
  for select using (
    status = 'active'
    or seller_id = (select auth.uid())
    or public.is_super_admin()
  );
create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and public.user_is_active());
create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()) or public.is_super_admin())
  with check (seller_id = (select auth.uid()) or public.is_super_admin());
create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = (select auth.uid()) or public.is_super_admin());

create policy listing_favorites_select_own on public.listing_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy listing_favorites_insert_own on public.listing_favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.user_is_active());
create policy listing_favorites_delete_own on public.listing_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

create policy listing_reports_insert on public.listing_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.user_is_active());
create policy listing_reports_select_admin on public.listing_reports
  for select to authenticated using (public.is_super_admin());
create policy listing_reports_update_admin on public.listing_reports
  for update to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.increment_listing_view(p_id uuid)
returns void
language sql
security definer
set search_path to ''
as $function$
  update public.listings set views = views + 1 where id = p_id and status = 'active';
$function$;
