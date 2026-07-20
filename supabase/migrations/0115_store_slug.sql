-- Vanity store handle: a merchant-chosen slug so a store lives at a clean
-- matjarlb.com/<slug> URL (e.g. /passion) instead of /store/<uuid>. The locale
-- proxy already rewrites a bare path to /ar/<slug>, so matjarlb.com/passion works.
--
-- The slug shares the URL namespace with the site's top-level routes (/explore,
-- /market, /store, /account, ...), so a store must NOT take one of those names or
-- its page would be shadowed and unreachable. A BEFORE trigger normalises the
-- slug (lower/trim), enforces the format, and rejects the reserved names; a
-- partial unique index enforces case-insensitive uniqueness (a clash raises 23505,
-- which the form maps to "already taken"). Runs only when slug is set/changed.

alter table public.stores add column if not exists slug text;

create unique index if not exists stores_slug_unique
  on public.stores (lower(slug)) where slug is not null;

create or replace function public.validate_store_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Every top-level route segment under (site)/(auth)/(dashboard) plus a few
  -- system words. Keep in sync with the app's routes: a name here can never be a
  -- slug, so the store page can never be shadowed by a real route.
  v_reserved text[] := array[
    'about','account','best-sellers','bookings','categories','category','clearance',
    'contact','delivery','explore','favorites','flash','following','freelance','help',
    'jobs','map','market','messages','notifications','offers','orders','pricing',
    'privacy','product','products','search','store','stores','track','wholesale',
    'wishlist','login','logout','register','signup','merchant','admin','auth','api',
    's','u','new','edit','settings','ar','en','www','mail','blog','null','undefined'
  ];
begin
  if new.slug is null then
    return new;
  end if;
  new.slug := lower(btrim(new.slug));
  if new.slug = '' then
    new.slug := null;
    return new;
  end if;
  -- 3-30 chars, starts/ends alphanumeric, lowercase letters/digits/hyphens inside.
  if new.slug !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' then
    raise exception 'slug_invalid';
  end if;
  if new.slug = any (v_reserved) then
    raise exception 'slug_reserved';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_store_slug() from public, anon, authenticated;

drop trigger if exists stores_validate_slug on public.stores;
create trigger stores_validate_slug
  before insert or update of slug on public.stores
  for each row execute function public.validate_store_slug();
