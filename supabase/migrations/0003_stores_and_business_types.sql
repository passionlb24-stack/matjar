-- Phase 1 — stores foundation: business types, stores, RLS, role protection.

create type store_status as enum ('pending', 'active', 'suspended', 'rejected');
create type store_plan as enum ('free', 'pro');

-- The 6 business modules merchants can choose from.
create table public.business_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  icon text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger business_types_set_updated_at
  before update on public.business_types
  for each row execute function public.set_updated_at();

-- A merchant's store / business page.
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  business_type_id uuid references public.business_types (id),
  name text not null,
  slug text unique,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  whatsapp text,
  region text,
  area text,
  address text,
  status store_status not null default 'pending',
  plan store_plan not null default 'free',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index stores_owner_id_idx on public.stores (owner_id);
create index stores_status_idx on public.stores (status);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- Prevent users from escalating their own role; only super_admins may change it.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

revoke execute on function public.prevent_role_change() from public, anon, authenticated;

-- ===== RLS =====
alter table public.business_types enable row level security;
alter table public.stores enable row level security;

create policy "business_types_select_active"
  on public.business_types for select
  using (is_active = true);

create policy "stores_select_public"
  on public.stores for select
  using (status = 'active' and deleted_at is null);

create policy "stores_select_own"
  on public.stores for select
  using (auth.uid() = owner_id);

create policy "stores_insert_own"
  on public.stores for insert
  with check (auth.uid() = owner_id);

create policy "stores_update_own"
  on public.stores for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ===== Seed business types =====
insert into public.business_types (slug, name_ar, name_en, icon, sort_order) values
  ('food',       'مطاعم ومأكولات', 'Food & dining',  'utensils-crossed', 1),
  ('retail',     'تسوّق ومنتجات',  'Shopping',        'shopping-bag',     2),
  ('services',   'خدمات',          'Services',        'wrench',           3),
  ('healthcare', 'صحة وعيادات',    'Health & clinics','stethoscope',      4),
  ('realEstate', 'عقارات',         'Real estate',     'building-2',       5),
  ('automotive', 'سيارات',         'Automotive',      'car',              6);
