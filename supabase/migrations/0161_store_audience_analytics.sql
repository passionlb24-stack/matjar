-- Merchant "Audience" analytics: who visited the storefront, from where, and how
-- many of those visits turned into an order. Salla surfaces visits + traffic
-- sources + conversion to the merchant; our reports page only had the SALES
-- side. This adds the audience side with a privacy-respecting, low-overhead
-- visit log.
--
-- Privacy: no PII. A visit row holds only the store/product viewed, a bucketed
-- traffic source (derived server-side from the referrer host — the raw referrer
-- is never stored), a random client-generated visitor id (localStorage, not an
-- identity), and a timestamp. Writes go through track_store_visit() and reads
-- through store_audience() — both SECURITY DEFINER — so the table needs no
-- permissive RLS policies (deny-all for direct client access is the intent).

create table if not exists public.store_visits (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  path text not null default 'store',      -- 'store' | 'product'
  source text not null default 'direct',   -- bucketed referrer
  visitor text,                            -- random client id, no PII
  created_at timestamptz not null default now()
);

create index if not exists store_visits_store_created_idx
  on public.store_visits (store_id, created_at desc);
create index if not exists store_visits_store_product_idx
  on public.store_visits (store_id, product_id);

alter table public.store_visits enable row level security;
-- No policies on purpose: all access is mediated by the two functions below.

-- Write path. Anon-callable (visitors aren't signed in). Validates the store is
-- real + publicly active, buckets the referrer into a small fixed set of
-- sources server-side, and caps the visitor string. It can only append a visit
-- row — it cannot read or mutate anything else.
create or replace function public.track_store_visit(
  p_store_id uuid,
  p_product_id uuid default null,
  p_path text default 'store',
  p_referrer text default null,
  p_visitor text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_source text := 'direct';
  v_host text;
begin
  -- Only track real, publicly-visible stores.
  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.status = 'active'
  ) then
    return;
  end if;

  -- Bucket the referrer host into a small, fixed set of traffic sources.
  if p_referrer is not null and length(p_referrer) > 0 then
    v_host := lower(coalesce(
      substring(p_referrer from '^[a-zA-Z]+://([^/]+)'), p_referrer));
    if v_host like '%google.%' then v_source := 'google';
    elsif v_host like '%instagram.%' then v_source := 'instagram';
    elsif v_host like '%facebook.%' or v_host like '%fb.com%'
       or v_host like '%fb.me%' then v_source := 'facebook';
    elsif v_host like '%wa.me%' or v_host like '%whatsapp%' then v_source := 'whatsapp';
    elsif v_host like '%tiktok.%' then v_source := 'tiktok';
    elsif v_host like '%t.co%' or v_host like '%twitter.%'
       or v_host = 'x.com' or v_host like '%.x.com' then v_source := 'twitter';
    elsif v_host like '%matjarlb.com%' or v_host like '%localhost%'
       or v_host like '127.0.0.1%' then v_source := 'internal';
    else v_source := 'other';
    end if;
  end if;

  insert into public.store_visits (store_id, product_id, path, source, visitor)
  values (
    p_store_id,
    p_product_id,
    case when p_path in ('store', 'product') then p_path else 'store' end,
    v_source,
    left(nullif(p_visitor, ''), 64)
  );
end $$;

revoke execute on function
  public.track_store_visit(uuid, uuid, text, text, text) from public;
grant execute on function
  public.track_store_visit(uuid, uuid, text, text, text) to anon, authenticated;

-- Read path. Aggregates the audience picture for the merchant reports page over
-- the last p_days days: total + unique visitors, product views, conversion
-- (orders ÷ unique visitors), a daily visits series, traffic-source breakdown,
-- and the most-viewed products. Mirrors store_report's auth check.
create or replace function public.store_audience(p_store_id uuid, p_days int default 14)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_total int;
  v_unique int;
  v_store int;
  v_product int;
  v_orders int;
  v_conv numeric(6, 1);
  v_per_day jsonb;
  v_sources jsonb;
  v_top jsonb;
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  select count(*)::int,
         count(distinct visitor) filter (where visitor is not null)::int,
         count(*) filter (where path = 'store')::int,
         count(*) filter (where path = 'product')::int
    into v_total, v_unique, v_store, v_product
    from public.store_visits
   where store_id = p_store_id and created_at >= v_since;

  select count(*)::int into v_orders
    from public.orders
   where store_id = p_store_id and created_at >= v_since;

  v_conv := case when v_unique > 0
                 then round((v_orders::numeric / v_unique) * 100, 1)
                 else 0 end;

  -- Daily visits + unique visitors for the last p_days days.
  select coalesce(jsonb_agg(
           jsonb_build_object('day', d.day, 'visits', d.visits,
                              'uniques', d.uniques) order by d.day), '[]'::jsonb)
    into v_per_day
  from (
    select gs::date as day,
      (select count(*)::int from public.store_visits v
         where v.store_id = p_store_id
           and (v.created_at at time zone 'UTC')::date = gs::date) as visits,
      (select count(distinct v.visitor)::int from public.store_visits v
         where v.store_id = p_store_id and v.visitor is not null
           and (v.created_at at time zone 'UTC')::date = gs::date) as uniques
    from generate_series(
      (now() at time zone 'UTC')::date - (p_days - 1),
      (now() at time zone 'UTC')::date,
      interval '1 day'
    ) gs
  ) d;

  -- Traffic-source breakdown.
  select coalesce(jsonb_agg(
           jsonb_build_object('source', source, 'visits', c)
           order by c desc), '[]'::jsonb)
    into v_sources
  from (
    select source, count(*)::int as c
      from public.store_visits
     where store_id = p_store_id and created_at >= v_since
     group by source
  ) s;

  -- Most-viewed products.
  select coalesce(jsonb_agg(
           jsonb_build_object('name', name, 'views', views)
           order by views desc), '[]'::jsonb)
    into v_top
  from (
    select coalesce(p.name, '—') as name, count(*)::int as views
      from public.store_visits v
      join public.products p on p.id = v.product_id
     where v.store_id = p_store_id and v.path = 'product'
       and v.created_at >= v_since
     group by p.name
     order by views desc
     limit 8
  ) t;

  return jsonb_build_object(
    'total_visits', v_total,
    'unique_visitors', v_unique,
    'store_visits', v_store,
    'product_views', v_product,
    'orders', v_orders,
    'conversion', v_conv,
    'per_day', v_per_day,
    'sources', v_sources,
    'top_viewed', v_top
  );
end $$;

revoke execute on function public.store_audience(uuid, int) from public, anon;
grant execute on function public.store_audience(uuid, int) to authenticated;
