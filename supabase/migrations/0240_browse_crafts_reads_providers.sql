-- 0240: point the directory at providers instead of stores.
--
-- Same contract and the same card shape as 0237 — the pages did not change,
-- only what fills them. The store-based link tables go at the end, once nothing
-- reads them; nothing was ever written to them outside a rolled-back test.

drop function if exists public.browse_crafts(text, text, text, text, text, int);

create or replace function public.browse_crafts(
  p_trade  text default null,
  p_area   text default null,
  p_region text default null,
  p_q      text default null,
  p_sort   text default 'rating',
  p_limit  int  default 40)
returns table(
  id            uuid,
  name          text,
  headline      text,
  photo_url     text,
  kind          text,
  area          text,
  region        text,
  years_experience int,
  rating_avg    numeric,
  rating_count  int,
  verified      boolean,
  has_whatsapp  boolean,
  trades        jsonb,
  service_areas jsonb,
  from_price    numeric,
  works_count   int
)
language sql
stable
security definer
set search_path to ''
as $function$
  with base as (
    select p.*
    from public.craft_providers p
    where p.status = 'active'
      -- A provider with no trade cannot be looked for, so they are not a
      -- result. Their profile still exists; it is simply not findable yet.
      and exists (select 1 from public.craft_provider_trades pt where pt.provider_id = p.id)
      and (p_region is null or p.region = p_region)
      and (p_trade is null or exists (
            select 1 from public.craft_provider_trades pt
            join public.trades t on t.id = pt.trade_id
            where pt.provider_id = p.id and t.slug = p_trade and t.active))
      -- "Do you come to me?" — from declared coverage, never guessed from where
      -- they happen to live.
      and (p_area is null or exists (
            select 1 from public.craft_provider_areas pa
            join public.lb_areas a on a.id = pa.area_id
            where pa.provider_id = p.id and a.slug = p_area))
      and (
        length(public.normalize_search(coalesce(p_q, ''))) = 0
        or public.trade_match(p.name, p_q)
        or public.trade_match(coalesce(p.headline, ''), p_q)
        or exists (
            select 1 from public.craft_provider_trades pt
            join public.trades t on t.id = pt.trade_id
            where pt.provider_id = p.id
              and (public.trade_match(t.name_ar, p_q)
                or exists (select 1 from unnest(t.synonyms) sy
                           where public.trade_match(sy, p_q))))
      )
  )
  select
    b.id, b.name, b.headline, b.photo_url, b.kind,
    (select a.name_ar from public.lb_areas a where a.id = b.area_id) as area,
    b.region, b.years_experience, b.rating_avg, b.rating_count, b.verified,
    nullif(btrim(coalesce(b.whatsapp, '')), '') is not null as has_whatsapp,
    coalesce((select jsonb_agg(jsonb_build_object(
                'slug', t.slug, 'name_ar', t.name_ar, 'name_en', t.name_en, 'icon', t.icon)
                order by t.sort_order)
              from public.craft_provider_trades pt join public.trades t on t.id = pt.trade_id
              where pt.provider_id = b.id and t.active), '[]'::jsonb)      as trades,
    coalesce((select jsonb_agg(jsonb_build_object(
                'slug', a.slug, 'name_ar', a.name_ar, 'name_en', a.name_en)
                order by a.sort_order)
              from public.craft_provider_areas pa join public.lb_areas a on a.id = pa.area_id
              where pa.provider_id = b.id), '[]'::jsonb)                   as service_areas,
    -- The cheapest thing they will actually name a number for. A quote-only
    -- service has no price to show and must not read as free.
    (select min(s.price) from public.craft_services s
      where s.provider_id = b.id and s.pricing_type <> 'quote'
        and s.price is not null and s.price > 0)                           as from_price,
    (select count(*)::int from public.craft_works w where w.provider_id = b.id) as works_count
  from base b
  order by
    -- "No reviews yet" is not "bad": unrated providers sort after rated ones
    -- rather than below them as if they had scored zero.
    case when p_sort = 'rating'     then (b.rating_count > 0) end desc nulls last,
    case when p_sort = 'rating'     then b.rating_avg end desc nulls last,
    case when p_sort = 'reviews'    then b.rating_count end desc nulls last,
    case when p_sort = 'experience' then b.years_experience end desc nulls last,
    b.rating_count desc, b.name
  limit greatest(p_limit, 1);
$function$;

revoke execute on function public.browse_crafts(text, text, text, text, text, int) from public;
grant  execute on function public.browse_crafts(text, text, text, text, text, int) to anon, authenticated;

create or replace function public.trade_provider_counts()
returns table(slug text, n int)
language sql
stable
security definer
set search_path to ''
as $function$
  select t.slug, count(*)::int
  from public.craft_provider_trades pt
  join public.trades t on t.id = pt.trade_id
  join public.craft_providers p on p.id = pt.provider_id
  where p.status = 'active' and t.active
  group by t.slug;
$function$;

revoke execute on function public.trade_provider_counts() from public;
grant  execute on function public.trade_provider_counts() to anon, authenticated;

drop table if exists public.store_trades;
drop table if exists public.store_service_areas;
