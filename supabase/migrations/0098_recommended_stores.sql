-- Personalized "For you" recommendations for the homepage.
--
-- The homepage store listing is public + cached cross-request (unstable_cache in
-- src/lib/data/stores.ts), so it can't carry per-user data. This RPC is the
-- per-user layer: the browser calls it AFTER load from a client island, keeping
-- the homepage server render user-agnostic (and therefore still cacheable).
--
-- It recommends active stores in the SAME categories the signed-in user already
-- engages with (stores they FOLLOW or have ORDERED from), excluding stores they
-- already follow and their own stores. A user with no follows/orders gets an
-- empty set, so brand-new users (and anon, who can't execute this) see nothing
-- and the strip stays hidden.
--
-- SECURITY DEFINER + empty search_path so it reads across follows/orders/stores
-- for auth.uid() regardless of the caller's RLS; execute is granted to
-- authenticated only (revoked from public/anon).
create or replace function public.recommended_stores(p_limit int default 8)
returns table (
  id uuid,
  name text,
  area text,
  region text,
  plan text,
  is_verified boolean,
  commercial_reg_verified boolean,
  featured_until timestamptz,
  logo_url text,
  cover_url text,
  lat numeric,
  lng numeric,
  hours jsonb,
  rating_avg numeric,
  rating_count int,
  category text
)
language sql
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  -- Business types the user has shown affinity for: any category of a store
  -- they follow or have placed an order with.
  affinity as (
    select distinct s.business_type_id
    from public.stores s
    where s.business_type_id is not null
      and (
        s.id in (
          select f.store_id from public.follows f
          where f.user_id = (select uid from me)
        )
        or s.id in (
          select o.store_id from public.orders o
          where o.customer_id = (select uid from me)
        )
      )
  )
  select
    s.id,
    s.name,
    s.area,
    s.region,
    s.plan::text,
    s.is_verified,
    s.commercial_reg_verified,
    s.featured_until,
    s.logo_url,
    s.cover_url,
    s.lat,
    s.lng,
    s.hours,
    s.rating_avg,
    s.rating_count,
    bt.slug as category
  from public.stores s
  join public.business_types bt on bt.id = s.business_type_id
  where (select uid from me) is not null
    and s.status = 'active'
    and s.deleted_at is null
    and s.business_type_id in (select business_type_id from affinity)
    and s.owner_id <> (select uid from me)
    and s.id not in (
      select f.store_id from public.follows f
      where f.user_id = (select uid from me)
    )
  order by
    (s.featured_until is not null and s.featured_until > now()) desc,
    s.rating_avg desc nulls last,
    s.created_at desc
  limit greatest(1, coalesce(p_limit, 8));
$$;

revoke execute on function public.recommended_stores(int) from public, anon;
grant execute on function public.recommended_stores(int) to authenticated;
