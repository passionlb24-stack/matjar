-- 0215: the trust a freelancer can show before they have a track record.
--
-- The section has 3 gigs and 0 completed jobs. Every trust signal a services
-- marketplace normally leans on — rating, jobs completed, repeat clients,
-- response time — is DERIVED from transactions, so all of them read zero. A card
-- showing "★ 0.0 · 0 projects" is worse than the plain card it replaces: the
-- plain one reads as new, the zeroed one reads as abandoned.
--
-- So the card has one evidence slot whose contents depend on what exists.
-- Declared trust today (verified identity, region, availability, what's
-- included), earned trust as soon as there is any. This migration adds the
-- declared half, plus the columns the earned half will fill later — so the
-- design does not need rewriting when the first job lands.
--
-- 0205 already added bio + skills to profiles and public_lister_profile(); this
-- extends both rather than starting a second profile.

-- ── 1. Declared trust on the person ────────────────────────────────────────
alter table public.profiles
  add column if not exists freelancer_verified boolean not null default false,
  add column if not exists freelancer_verified_at timestamptz,
  add column if not exists languages jsonb;   -- string[] e.g. ["ar","en","fr"]

comment on column public.profiles.freelancer_verified is
  'Identity checked by the platform. The strongest signal available with zero completed jobs, and the only badge that does not need a transaction to exist.';

-- Verification is a platform claim, so only the platform may set it — a
-- self-serve badge is not a trust signal.
create or replace function public.set_freelancer_verified(
  p_user uuid,
  p_verified boolean
) returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_super_admin() then
    raise exception 'not allowed';
  end if;
  update public.profiles
  set freelancer_verified = p_verified,
      freelancer_verified_at = case when p_verified then now() else null end
  where id = p_user;
end $function$;

-- ── 2. Availability, with an expiry ────────────────────────────────────────
-- "Available now" that a freelancer sets once and forgets becomes a lie within a
-- week, and a badge nobody trusts is worse than no badge. It carries a date and
-- stops being true on its own.
alter table public.gigs
  add column if not exists available_until date;

comment on column public.gigs.available_until is
  'Freelancer-set. NULL or past = not shown as available. Deliberately expires so the badge cannot rot into a false claim.';

-- ── 3. Where earned trust will land ────────────────────────────────────────
-- Added now, empty, so the card can read one shape for its whole life.
alter table public.gigs
  add column if not exists completed_count integer not null default 0
    check (completed_count >= 0),
  add column if not exists rating_avg numeric(3,2)
    check (rating_avg is null or (rating_avg >= 0 and rating_avg <= 5)),
  add column if not exists rating_count integer not null default 0
    check (rating_count >= 0),
  add column if not exists country_code text not null default 'LB';

comment on column public.gigs.rating_avg is
  'NULL until the first rating — not 0. The card treats NULL as "no evidence yet" and shows declared trust instead; 0 would render as a one-star service.';

create index if not exists gigs_browse_idx
  on public.gigs (status, category, created_at desc)
  where status = 'active';

-- ── 4. One query for a browsable card ──────────────────────────────────────
-- The freelancer's name, photo and verified flag live on profiles, whose RLS is
-- own-row-only (see 0205). A list page therefore cannot join to it, and calling
-- public_lister_profile() per gig is N+1. This returns the whole card, filtered,
-- in one round trip — which is also what makes the filters server-side rather
-- than a client-side pass over whatever happened to be fetched.
create or replace function public.browse_gigs(
  p_category text default null,
  p_region text default null,
  p_verified_only boolean default false,
  p_available_only boolean default false,
  p_max_days integer default null,
  p_max_price numeric default null,
  p_q text default null,
  p_limit integer default 48
) returns table (
  id uuid,
  title text,
  description text,
  category text,
  price numeric,
  delivery_days integer,
  revisions integer,
  includes jsonb,
  image_url text,
  gallery jsonb,
  region text,
  created_at timestamptz,
  available_until date,
  completed_count integer,
  rating_avg numeric,
  rating_count integer,
  freelancer_id uuid,
  freelancer_name text,
  freelancer_avatar text,
  freelancer_verified boolean,
  freelancer_since timestamptz
) language sql stable security definer set search_path to '' as $function$
  select g.id, g.title, g.description, g.category, g.price, g.delivery_days,
         g.revisions, g.includes, g.image_url, g.gallery, g.region, g.created_at,
         g.available_until, g.completed_count, g.rating_avg, g.rating_count,
         g.freelancer_id,
         coalesce(nullif(btrim(p.full_name), ''), g.freelancer_name),
         p.avatar_url,
         coalesce(p.freelancer_verified, false),
         p.created_at
  from public.gigs g
  left join public.profiles p on p.id = g.freelancer_id
  where g.status = 'active'
    and (p_category is null or g.category = p_category)
    and (p_region is null or g.region = p_region)
    and (not p_verified_only or coalesce(p.freelancer_verified, false))
    and (not p_available_only
         or (g.available_until is not null and g.available_until >= current_date))
    and (p_max_days is null or g.delivery_days is null or g.delivery_days <= p_max_days)
    and (p_max_price is null or g.price is null or g.price <= p_max_price)
    and (
      p_q is null or btrim(p_q) = ''
      or g.title ilike '%' || btrim(p_q) || '%'
      or g.description ilike '%' || btrim(p_q) || '%'
      or coalesce(p.full_name, g.freelancer_name) ilike '%' || btrim(p_q) || '%'
    )
  -- Verified first, then available, then whoever has evidence — with 3 gigs the
  -- ordering barely bites, but it is what makes the section feel curated as it
  -- fills rather than needing a re-sort later.
  order by coalesce(p.freelancer_verified, false) desc,
           (g.available_until is not null and g.available_until >= current_date) desc,
           g.completed_count desc,
           g.created_at desc
  limit greatest(1, least(coalesce(p_limit, 48), 96));
$function$;

revoke all on function public.browse_gigs(text, text, boolean, boolean, integer, numeric, text, integer) from public;
grant execute on function public.browse_gigs(text, text, boolean, boolean, integer, numeric, text, integer)
  to anon, authenticated;

-- ── 5. What the section can honestly offer ─────────────────────────────────
-- Drives which filters and which homepage sections are shown at all. A filter
-- that returns nothing, or a section header over an empty row, tells a visitor
-- the marketplace is empty — which is the one impression worth designing around
-- while it is small.
create or replace function public.gig_facets()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'total',     count(*),
    'verified',  count(*) filter (where coalesce(p.freelancer_verified, false)),
    'available', count(*) filter (where g.available_until >= current_date),
    'rated',     count(*) filter (where g.rating_count > 0),
    'categories', coalesce((
      select jsonb_object_agg(cat, n) from (
        select g2.category as cat, count(*) as n
        from public.gigs g2 where g2.status = 'active' and g2.category is not null
        group by g2.category
      ) c
    ), '{}'::jsonb),
    'regions', coalesce((
      select jsonb_object_agg(reg, n) from (
        select g3.region as reg, count(*) as n
        from public.gigs g3 where g3.status = 'active' and g3.region is not null
        group by g3.region
      ) r
    ), '{}'::jsonb)
  )
  from public.gigs g
  left join public.profiles p on p.id = g.freelancer_id
  where g.status = 'active';
$function$;

revoke all on function public.gig_facets() from public;
grant execute on function public.gig_facets() to anon, authenticated;

-- ── 6. Extend the existing public profile ──────────────────────────────────
-- Adding OUT columns changes the return type, which `create or replace` refuses
-- (42P13). It has to be dropped first — safe here because the drop and the
-- recreate are in one transaction, so the function is never missing to a caller.
drop function if exists public.public_lister_profile(uuid);

create or replace function public.public_lister_profile(p_user uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  skills jsonb,
  gig_count int,
  languages jsonb,
  freelancer_verified boolean,
  member_since timestamptz
)
language sql stable security definer set search_path to '' as $function$
  select p.id, p.full_name, p.avatar_url, p.bio, p.skills,
         (select count(*)::int from public.gigs g
          where g.freelancer_id = p.id and g.status = 'active'),
         p.languages,
         coalesce(p.freelancer_verified, false),
         p.created_at
  from public.profiles p
  where p.id = p_user
    and exists (
      select 1 from public.gigs g
      where g.freelancer_id = p.id and g.status = 'active'
    );
$function$;
