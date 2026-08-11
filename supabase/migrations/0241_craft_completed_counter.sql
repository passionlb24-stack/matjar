-- 0241: count the jobs actually finished.
--
-- The number this market trusts most is not a star average — it is "how many
-- times has this person turned up and finished". So it is counted, never
-- claimed: incremented only when a real craft_request reaches 'completed', and
-- decremented if it ever leaves that state.
--
-- Both directions for the same reason the stock, coupon and loyalty counters
-- got both today: a counter that only goes up drifts the first time anything is
-- corrected, and a tradesman who reopens a job he marked done too early would
-- keep the credit for it.
--
-- Guarded from the provider alongside status, verified and rating. A
-- self-editable "142 jobs done" is worth less than no number at all — it is
-- exactly the field a fake account would fill in first.
--
-- Verified on production inside rolled-back transactions, with the real
-- policies in force: the customer files the request, the tradesman completes it
-- (0 → 1), and reopening it puts the count back (1 → 0). A customer filing a
-- request under someone else's account was refused by RLS.

alter table public.craft_providers
  add column if not exists completed_count int not null default 0;

create or replace function public.sync_craft_completed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.craft_providers
       set completed_count = completed_count + 1
     where id = new.provider_id;
  elsif old.status = 'completed' and new.status <> 'completed' then
    update public.craft_providers
       set completed_count = greatest(completed_count - 1, 0)
     where id = new.provider_id;
  end if;
  return null;
end
$function$;

drop trigger if exists craft_requests_sync_completed on public.craft_requests;
create trigger craft_requests_sync_completed
  after update on public.craft_requests
  for each row execute function public.sync_craft_completed();

create or replace function public.guard_craft_provider_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_super_admin() then return new; end if;

  new.status          := old.status;
  new.verified        := old.verified;
  new.verified_at     := old.verified_at;
  new.rating_avg      := old.rating_avg;
  new.rating_count    := old.rating_count;
  new.completed_count := old.completed_count;
  new.user_id         := old.user_id;
  return new;
end
$function$;

-- browse_crafts gains completed_count and a 'completed' sort. Dropped and
-- recreated because the OUT parameters changed.
drop function if exists public.browse_crafts(text, text, text, text, text, int);

create function public.browse_crafts(
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
  completed_count int,
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
    b.region, b.years_experience, b.rating_avg, b.rating_count, b.completed_count,
    b.verified,
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
    case when p_sort = 'completed'  then b.completed_count end desc nulls last,
    case when p_sort = 'experience' then b.years_experience end desc nulls last,
    b.rating_count desc, b.name
  limit greatest(p_limit, 1);
$function$;

revoke execute on function public.browse_crafts(text, text, text, text, text, int) from public;
grant  execute on function public.browse_crafts(text, text, text, text, text, int) to anon, authenticated;
