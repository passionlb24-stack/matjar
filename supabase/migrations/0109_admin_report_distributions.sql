-- The admin/reports page moved its headline KPIs to admin_platform_report (0104),
-- but its DISTRIBUTION bars (stores by status/region/type, users by role, top
-- stores by order count) were still built by fetching every row into the page and
-- reducing in JS. Past PostgREST's 1000-row default that silently truncates — at
-- scale the bars (especially users by role, from the large profiles table) would
-- undercount with no error. This RPC computes every breakdown server-side with
-- unbounded aggregates in one round-trip, gated to super_admins only.
create or replace function public.admin_report_distributions()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_by_status jsonb;
  v_by_region jsonb;
  v_by_type jsonb;
  v_by_role jsonb;
  v_top_stores jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'not_authorized';
  end if;

  -- Stores by status (non-deleted).
  select coalesce(
    jsonb_agg(jsonb_build_object('status', status, 'count', c) order by c desc),
    '[]'::jsonb)
    into v_by_status
    from (
      select status::text as status, count(*)::int as c
      from public.stores
      where deleted_at is null
      group by status
    ) s;

  -- Stores by region (non-deleted, region present).
  select coalesce(
    jsonb_agg(jsonb_build_object('region', region, 'count', c) order by c desc),
    '[]'::jsonb)
    into v_by_region
    from (
      select region, count(*)::int as c
      from public.stores
      where deleted_at is null and region is not null and region <> ''
      group by region
    ) s;

  -- Stores by business type — joined to business_types so the page keeps the
  -- localized (name_ar / name_en) label it renders.
  select coalesce(
    jsonb_agg(jsonb_build_object('name_ar', name_ar, 'name_en', name_en, 'count', c) order by c desc),
    '[]'::jsonb)
    into v_by_type
    from (
      select bt.name_ar, bt.name_en, count(*)::int as c
      from public.stores s
      join public.business_types bt on bt.id = s.business_type_id
      where s.deleted_at is null
      group by bt.name_ar, bt.name_en
    ) t;

  -- Users by role (from profiles — the most truncation-prone breakdown).
  select coalesce(
    jsonb_agg(jsonb_build_object('role', role, 'count', c) order by c desc),
    '[]'::jsonb)
    into v_by_role
    from (
      select role::text as role, count(*)::int as c
      from public.profiles
      where role is not null
      group by role
    ) p;

  -- Top stores by order count. Capped at the 10 busiest — the page renders a short
  -- leaderboard, so returning the full store list would bloat the payload for no gain.
  select coalesce(
    jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc),
    '[]'::jsonb)
    into v_top_stores
    from (
      select s.name, count(o.id)::int as c
      from public.stores s
      join public.orders o on o.store_id = s.id
      where s.deleted_at is null
      group by s.id, s.name
      order by c desc
      limit 10
    ) ts;

  return jsonb_build_object(
    'by_status', v_by_status,
    'by_region', v_by_region,
    'by_type', v_by_type,
    'by_role', v_by_role,
    'top_stores', v_top_stores
  );
end $$;

revoke execute on function public.admin_report_distributions() from public, anon;
grant execute on function public.admin_report_distributions() to authenticated;
