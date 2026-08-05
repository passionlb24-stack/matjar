-- 0216: record the things the admin console will need to be able to ask about.
--
-- Nine of the admin sections in the brief are not hard, they are impossible: the
-- table does not exist, so the metric cannot be shown at any scale. That is a
-- different problem from "the numbers are small", and it has a deadline — every
-- day without logging is a day of data that can never be recovered. What people
-- searched for last month is gone.
--
-- This adds the cheapest four that unlock the most:
--
--   search_logs      — what people looked for and whether they found it. The
--                      "no results" list is demand with no supply, which is the
--                      single most actionable thing this platform can know.
--   store_visits     — device and city, two columns that unlock a whole section.
--   content_reports  — one report table for every entity. listing_reports only
--                      covered Sunday Market, so nothing else could be flagged.
--   attention_queue  — the admin home: what needs a person today, ranked by the
--                      cost of ignoring it rather than by size.
--
-- Support tickets are deliberately NOT here. A ticket table nobody writes to is
-- worse than none — it needs an inbox, statuses and a reply path, which is a
-- product, not a migration.

-- ── 1. What people searched for ────────────────────────────────────────────
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  q text not null,
  -- Normalised so "قميص" and " قَميص " group together in the gap report. The
  -- raw text is kept because the exact wording is what you paste into an ad.
  q_norm text not null,
  section text not null default 'stores'
    check (section in ('stores','products','freelance','jobs','market','wholesale')),
  results_count integer not null default 0 check (results_count >= 0),
  region text,
  user_id uuid references auth.users(id) on delete set null,
  country_code text not null default 'LB',
  created_at timestamptz not null default now()
);

-- The index the gap report actually runs on: zero-result searches, recent first.
create index if not exists search_logs_empty_idx
  on public.search_logs (q_norm, created_at desc)
  where results_count = 0;
create index if not exists search_logs_time_idx
  on public.search_logs (created_at desc);

alter table public.search_logs enable row level security;

-- Visitors write through the function below and never read. Search history is
-- other people's intent; only the platform sees it.
drop policy if exists search_logs_admin_read on public.search_logs;
create policy search_logs_admin_read on public.search_logs for select
  using (public.is_platform_admin());

-- Strips the diacritics FIRST, then folds the alef/ya/ta-marbuta variants, then
-- collapses whitespace. Order matters: translate() cannot see past a harakat, so
-- folding before stripping leaves "قَميص" and "قميص" as two different terms —
-- which silently splits the one report this whole table exists to produce.
create or replace function public.normalize_search(p_q text)
returns text language sql immutable set search_path to '' as $function$
  select nullif(
    regexp_replace(
      translate(
        regexp_replace(lower(btrim(coalesce(p_q, ''))), '[ًٌٍَُِّْـ]', '', 'g'),
        'أإآٱىة', 'ااااية'
      ),
      '\s+', ' ', 'g'
    ), '');
$function$;

create or replace function public.log_search(
  p_q text,
  p_section text default 'stores',
  p_results integer default 0,
  p_region text default null
) returns void language plpgsql security definer set search_path to '' as $function$
declare v_norm text;
begin
  v_norm := public.normalize_search(p_q);
  -- One character is a keystroke, not a search; logging it would bury the signal.
  if v_norm is null or length(v_norm) < 2 then
    return;
  end if;
  insert into public.search_logs (q, q_norm, section, results_count, region, user_id)
  values (left(btrim(p_q), 120), v_norm,
          case when p_section in ('stores','products','freelance','jobs','market','wholesale')
               then p_section else 'stores' end,
          greatest(coalesce(p_results, 0), 0), p_region, auth.uid());
end $function$;

revoke all on function public.log_search(text, text, integer, text) from public;
grant execute on function public.log_search(text, text, integer, text) to anon, authenticated;

-- ── 2. Two columns on the visit ────────────────────────────────────────────
alter table public.store_visits add column if not exists device text
  check (device is null or device in ('mobile','tablet','desktop'));
alter table public.store_visits add column if not exists city text;

comment on column public.store_visits.device is
  'Derived from the user agent at write time. Bucketed, not the raw UA — the buckets are what a decision is ever made on, and the raw string is a fingerprinting surface.';

-- track_store_visit gains the two. Dropped first, not just replaced: adding
-- parameters with defaults creates a SECOND function rather than replacing the
-- old one, and the existing five-argument calls would then be ambiguous.
--
-- The body below is the original, unchanged, plus two columns. It matters that
-- it is unchanged: the referrer-to-source mapping is what every traffic figure
-- is built on, and rewriting it would have kept inserting rows while quietly
-- turning every source into a raw URL.
drop function if exists public.track_store_visit(uuid, uuid, text, text, text);

create or replace function public.track_store_visit(
  p_store_id uuid,
  p_product_id uuid default null,
  p_path text default 'store',
  p_referrer text default null,
  p_visitor text default null,
  p_device text default null,
  p_city text default null
) returns void language plpgsql security definer set search_path to '' as $function$
declare
  v_source text := 'direct';
  v_host text;
begin
  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.status = 'active'
  ) then
    return;
  end if;

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

  insert into public.store_visits
    (store_id, product_id, path, source, visitor, device, city)
  values (
    p_store_id,
    p_product_id,
    case when p_path in ('store', 'product') then p_path else 'store' end,
    v_source,
    left(nullif(p_visitor, ''), 64),
    case when p_device in ('mobile','tablet','desktop') then p_device else null end,
    left(nullif(btrim(coalesce(p_city, '')), ''), 64)
  );
end $function$;

-- ── 3. One report table for everything ─────────────────────────────────────
-- listing_reports only ever covered Sunday Market, so a fake store, a stolen
-- product photo or an abusive review had nowhere to go.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('store','product','gig','job','listing','review','profile')),
  entity_id uuid not null,
  reason text not null,
  detail text,
  reporter_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','reviewing','actioned','dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  country_code text not null default 'LB',
  created_at timestamptz not null default now()
);

create index if not exists content_reports_queue_idx
  on public.content_reports (status, created_at)
  where status in ('pending','reviewing');
create index if not exists content_reports_entity_idx
  on public.content_reports (entity_type, entity_id);

-- The same person reporting the same thing twice is one report, not two.
create unique index if not exists content_reports_dedupe_idx
  on public.content_reports (entity_type, entity_id, reporter_id)
  where reporter_id is not null and status in ('pending','reviewing');

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports for insert
  to authenticated with check (reporter_id = (select auth.uid()));

-- is_platform_admin(), not admin_can('moderation') — there is no 'moderation'
-- section in admin-sections.ts, and a policy naming one that does not exist
-- would deny everyone while looking correct.
drop policy if exists content_reports_admin on public.content_reports;
create policy content_reports_admin on public.content_reports for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- A reporter can see what happened to their own report; nothing else.
drop policy if exists content_reports_own on public.content_reports;
create policy content_reports_own on public.content_reports for select
  using (reporter_id = (select auth.uid()));

-- ── 4. What needs a person today ───────────────────────────────────────────
-- The admin home. Ordered by the cost of ignoring an item, not by how big its
-- number is: three merchants waiting on approval outranks a hundred page views,
-- because the first is a decision going stale and the second is a fact.
--
-- Every entry carries its own count, so an empty queue renders as "nothing to
-- do" rather than as five zeroes. A dashboard that never empties teaches the
-- person reading it to stop looking.
create or replace function public.admin_attention_queue()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    -- A merchant waiting on approval is a merchant deciding whether to bother.
    'pending_stores', (
      select jsonb_build_object(
        'count', count(*),
        'oldest_hours', coalesce(round(extract(epoch from (now() - min(created_at))) / 3600), 0))
      from public.stores where status = 'pending' and deleted_at is null),

    -- The likeliest reason a visit does not become an order.
    'stores_missing_images', (
      select jsonb_build_object('stores', count(distinct store_id), 'products', count(*))
      from public.products
      where deleted_at is null and status = 'active'
        and coalesce(btrim(image_url), '') = ''),

    -- The last window to intervene before a trial store loses its catalogue.
    'trials_ending', (
      select jsonb_build_object(
        'count', count(*),
        'without_orders', count(*) filter (
          where not exists (select 1 from public.orders o where o.store_id = s.id)))
      from public.stores s
      where s.plan::text = 'free' and s.trial_ends_at is not null
        and s.trial_ends_at between now() and now() + interval '3 days'
        and s.deleted_at is null),

    -- A customer waiting is a repeat purchase not happening.
    'stale_orders', (
      select jsonb_build_object('count', count(*), 'stores', count(distinct store_id))
      from public.orders
      where status = 'pending' and created_at < now() - interval '24 hours'),

    -- Demand with no supply. Empty until log_search is wired into the UI, and
    -- deliberately so: an invented number here would be worse than none.
    'search_gaps', (
      select coalesce(jsonb_agg(g), '[]'::jsonb) from (
        select q_norm as term, count(*)::int as hits
        from public.search_logs
        where results_count = 0 and created_at >= now() - interval '7 days'
        group by q_norm having count(*) >= 2
        order by count(*) desc limit 8) g),

    'open_reports', (
      select count(*) from public.content_reports where status in ('pending','reviewing')),

    -- The one number worth putting above everything else: not signups, not
    -- visits — how many shops actually took money this week.
    'stores_selling_7d', (
      select count(distinct store_id) from public.orders
      where created_at >= now() - interval '7 days')
  ) into v;

  return v;
end $function$;

revoke all on function public.admin_attention_queue() from public;
grant execute on function public.admin_attention_queue() to authenticated;

-- ── 5. Demand the platform cannot serve ────────────────────────────────────
create or replace function public.admin_search_gaps(p_days integer default 30)
returns table (term text, searches bigint, last_seen timestamptz, section text)
language sql stable security definer set search_path to '' as $function$
  select s.q_norm,
         count(*),
         max(s.created_at),
         mode() within group (order by s.section)
  from public.search_logs s
  where s.results_count = 0
    and s.created_at >= now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
    and public.is_platform_admin()
  group by s.q_norm
  order by count(*) desc, max(s.created_at) desc
  limit 100;
$function$;

revoke all on function public.admin_search_gaps(integer) from public;
grant execute on function public.admin_search_gaps(integer) to authenticated;

comment on function public.admin_search_gaps is
  'Searches that returned nothing, most frequent first. This is a merchant acquisition list: each term is someone in Lebanon who wanted something Matjar could not show them.';
