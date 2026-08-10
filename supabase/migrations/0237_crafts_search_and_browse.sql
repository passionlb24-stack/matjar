-- 0237: finding a tradesman.
--
-- Two functions, and one idea between them: what a customer types is not what
-- the taxonomy calls things. Nobody searches "كهربائي" — they search "كهربجي".
-- Nobody searches "نقل أثاث" — they search "عفش". So matching runs over each
-- trade's names AND its synonyms, through normalize_search (0216) so harakat
-- and alef variants never matter.
--
-- WHY WORD-START AND NOT ANYWHERE
--
-- The first version used LIKE '%q%' and it was unusable for short queries: "مي"
-- (water) returned ميكانيكي, ترميم, تسليم and five more, because those two
-- letters sit mid-word all over Arabic. Anchoring to the start of a word cut
-- that to the four trades where مي actually begins a word — سبّاك, مضخات مياه,
-- خزانات مياه, ميكانيكي — and left every real match intact. Verified across
-- كهربجي, مكيف, براد, عفش, بنشر, جبس, انفرتر, سولار, حشرات, ونش.
--
-- The query has regex metacharacters stripped rather than escaped: everything a
-- customer types here is letters, digits or spaces, so nothing legitimate is
-- lost and no pattern can be injected.
--
-- browse_crafts returns finished cards — trades, coverage, rating, cheapest
-- listed price — so a result row needs no follow-up query per provider.
--
-- Two deliberate rules in it:
--   * only stores that have declared a trade appear. A shop that never said
--     what it does is not a search result, it is noise.
--   * unrated providers sort after rated ones rather than being treated as
--     zero stars, because "no reviews yet" is not "bad".

create or replace function public.trade_match(p_text text, p_q text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select public.normalize_search(p_text) ~
         ('(^|[[:space:]])' ||
          regexp_replace(public.normalize_search(p_q), '[^[:alnum:][:space:]ء-ي]', '', 'g'));
$function$;

create or replace function public.search_trades(p_q text, p_limit int default 8)
returns table(slug text, name_ar text, name_en text, group_slug text, icon text)
language sql
stable
security definer
set search_path to ''
as $function$
  select t.slug, t.name_ar, t.name_en, t.group_slug, t.icon
  from public.trades t
  where t.active
    and length(public.normalize_search(coalesce(p_q, ''))) > 0
    and (
      public.trade_match(t.name_ar, p_q)
      or public.trade_match(t.name_en, p_q)
      or exists (select 1 from unnest(t.synonyms) s where public.trade_match(s, p_q))
    )
  order by
    case when public.normalize_search(t.name_ar)
              like public.normalize_search(p_q) || '%' then 0 else 1 end,
    t.sort_order
  limit greatest(p_limit, 1);
$function$;

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
  slug          text,
  logo_url      text,
  area          text,
  region        text,
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
    select s.*
    from public.stores s
    where s.status = 'active'
      and s.deleted_at is null
      and exists (select 1 from public.store_trades st where st.store_id = s.id)
      and (p_region is null or s.region = p_region)
      and (p_trade is null or exists (
            select 1 from public.store_trades st
            join public.trades t on t.id = st.trade_id
            where st.store_id = s.id and t.slug = p_trade and t.active))
      -- "Do you come to me?" answered from declared coverage, never guessed
      -- from the shop's own address.
      and (p_area is null or exists (
            select 1 from public.store_service_areas sa
            join public.lb_areas a on a.id = sa.area_id
            where sa.store_id = s.id and a.slug = p_area))
      and (
        length(public.normalize_search(coalesce(p_q, ''))) = 0
        or public.trade_match(s.name, p_q)
        or exists (
            select 1 from public.store_trades st
            join public.trades t on t.id = st.trade_id
            where st.store_id = s.id
              and (public.trade_match(t.name_ar, p_q)
                or exists (select 1 from unnest(t.synonyms) sy
                           where public.trade_match(sy, p_q))))
      )
  )
  select
    b.id, b.name, b.slug, b.logo_url, b.area, b.region,
    b.rating_avg, b.rating_count,
    exists (select 1 from public.store_verifications v
             where v.store_id = b.id and v.status = 'verified')            as verified,
    nullif(btrim(coalesce(b.whatsapp, '')), '') is not null                as has_whatsapp,
    coalesce((select jsonb_agg(jsonb_build_object(
                'slug', t.slug, 'name_ar', t.name_ar, 'name_en', t.name_en, 'icon', t.icon)
                order by t.sort_order)
              from public.store_trades st join public.trades t on t.id = st.trade_id
              where st.store_id = b.id and t.active), '[]'::jsonb)          as trades,
    coalesce((select jsonb_agg(jsonb_build_object(
                'slug', a.slug, 'name_ar', a.name_ar, 'name_en', a.name_en)
                order by a.sort_order)
              from public.store_service_areas sa join public.lb_areas a on a.id = sa.area_id
              where sa.store_id = b.id), '[]'::jsonb)                       as service_areas,
    (select min(coalesce(p.discount_price, p.price))
       from public.products p
      where p.store_id = b.id and p.status = 'active'
        and p.is_available and p.deleted_at is null
        and coalesce(p.discount_price, p.price) > 0)                        as from_price,
    (select count(*)::int from public.products p
      where p.store_id = b.id and p.status = 'active'
        and p.is_available and p.deleted_at is null
        and p.image_url is not null)                                        as works_count
  from base b
  order by
    case when p_sort = 'rating'  then (b.rating_count > 0) end desc nulls last,
    case when p_sort = 'rating'  then b.rating_avg end desc nulls last,
    case when p_sort = 'reviews' then b.rating_count end desc nulls last,
    b.rating_count desc, b.name
  limit greatest(p_limit, 1);
$function$;

revoke execute on function public.trade_match(text, text) from public;
grant  execute on function public.trade_match(text, text) to anon, authenticated;
revoke execute on function public.search_trades(text, int) from public;
grant  execute on function public.search_trades(text, int) to anon, authenticated;
revoke execute on function public.browse_crafts(text, text, text, text, text, int) from public;
grant  execute on function public.browse_crafts(text, text, text, text, text, int) to anon, authenticated;
