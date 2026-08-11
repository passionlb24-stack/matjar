-- 0238: a tradesman is not a shop.
--
-- The first cut of this section hung trades off `stores`, reasoning that a
-- store already carries a profile, a gallery, reviews and service requests.
-- That was right about the plumbing and wrong about the person: it asked an
-- electrician to "open a store" before he could say he is an electrician.
-- Nobody with a van and a phone does that, and the freelancer side already had
-- the correct shape — a gig belongs to an account, not a storefront.
--
-- The taxonomy from 0235-0237 stays exactly as it is; it was never about
-- stores. Only what hangs off it changes. store_trades and store_service_areas
-- are dropped in 0240, once nothing reads them.
--
-- Four decisions worth naming:
--   * kind — a one-man operation and a maintenance company are both real here
--     and are shown differently, so it is stored rather than inferred.
--   * status defaults to 'pending'. The review queue is the only thing between
--     the directory and whoever wants to be in it.
--   * pricing_type per service, because trades do not price alike: a callout is
--     fixed, a rewire is quoted after seeing it, tiling is per metre. One shape
--     would make every provider lie a little.
--   * status, verified and rating are guarded from the provider by the same
--     trigger pattern as stores (0217) and profiles (0224).

create table if not exists public.craft_providers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.profiles(id) on delete cascade,
  kind           text not null default 'individual'
                 check (kind in ('individual', 'business')),
  name           text not null,
  headline       text,
  bio            text,
  photo_url      text,
  phone          text,
  whatsapp       text,
  years_experience int check (years_experience is null or years_experience between 0 and 70),
  region         text,
  area_id        uuid references public.lb_areas(id) on delete set null,
  hours          jsonb not null default '{}'::jsonb,
  status         text not null default 'pending'
                 check (status in ('pending', 'active', 'suspended', 'rejected')),
  verified       boolean not null default false,
  verified_at    timestamptz,
  rating_avg     numeric(3,2) not null default 0,
  rating_count   int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists craft_providers_status_idx on public.craft_providers (status);
create index if not exists craft_providers_region_idx on public.craft_providers (region);

create table if not exists public.craft_provider_trades (
  provider_id uuid not null references public.craft_providers(id) on delete cascade,
  trade_id    uuid not null references public.trades(id) on delete cascade,
  primary key (provider_id, trade_id)
);
create index if not exists craft_provider_trades_trade_idx
  on public.craft_provider_trades (trade_id);

create table if not exists public.craft_provider_areas (
  provider_id uuid not null references public.craft_providers(id) on delete cascade,
  area_id     uuid not null references public.lb_areas(id) on delete cascade,
  primary key (provider_id, area_id)
);
create index if not exists craft_provider_areas_area_idx
  on public.craft_provider_areas (area_id);

create table if not exists public.craft_services (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references public.craft_providers(id) on delete cascade,
  name         text not null,
  description  text,
  pricing_type text not null default 'from'
               check (pricing_type in ('fixed', 'from', 'hourly', 'per_meter', 'quote')),
  price        numeric(12,2) check (price is null or price >= 0),
  duration_minutes int,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists craft_services_provider_idx
  on public.craft_services (provider_id, sort_order);

-- Past jobs with photos. Not a digital portfolio — a record of work done.
create table if not exists public.craft_works (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.craft_providers(id) on delete cascade,
  title       text,
  image_url   text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists craft_works_provider_idx
  on public.craft_works (provider_id, sort_order);

alter table public.craft_providers       enable row level security;
alter table public.craft_provider_trades enable row level security;
alter table public.craft_provider_areas  enable row level security;
alter table public.craft_services        enable row level security;
alter table public.craft_works           enable row level security;

-- One question, asked once, reused by every child policy.
create or replace function public.owns_craft_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.craft_providers p
    where p.id = p_provider_id and p.user_id = (select auth.uid())
  );
$function$;

drop policy if exists craft_providers_public_read on public.craft_providers;
create policy craft_providers_public_read on public.craft_providers
  for select using (status = 'active');

drop policy if exists craft_providers_own_read on public.craft_providers;
create policy craft_providers_own_read on public.craft_providers
  for select using (user_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists craft_providers_insert on public.craft_providers;
create policy craft_providers_insert on public.craft_providers
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists craft_providers_update on public.craft_providers;
create policy craft_providers_update on public.craft_providers
  for update using (user_id = (select auth.uid()) or public.is_super_admin())
  with check (user_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists craft_providers_admin_delete on public.craft_providers;
create policy craft_providers_admin_delete on public.craft_providers
  for delete using (user_id = (select auth.uid()) or public.is_super_admin());

do $do$
declare t text;
begin
  foreach t in array array['craft_provider_trades', 'craft_provider_areas',
                           'craft_services', 'craft_works']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_manage', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.owns_craft_provider(provider_id) or public.is_super_admin())
         with check (public.owns_craft_provider(provider_id) or public.is_super_admin())',
      t || '_manage', t);
  end loop;
end
$do$;

create or replace function public.guard_craft_provider_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_super_admin() then return new; end if;

  new.status       := old.status;
  new.verified     := old.verified;
  new.verified_at  := old.verified_at;
  new.rating_avg   := old.rating_avg;
  new.rating_count := old.rating_count;
  new.user_id      := old.user_id;
  return new;
end
$function$;

drop trigger if exists craft_providers_guard on public.craft_providers;
create trigger craft_providers_guard
  before update on public.craft_providers
  for each row execute function public.guard_craft_provider_columns();
