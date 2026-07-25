-- Lightweight visits summary for the merchant dashboard's free "visits" tile.
-- The full audience report lives on the Pro reports page (store_audience); this
-- is a cheap headline count (total + unique, last N days) so EVERY merchant sees
-- a live pulse on their home and has a reason to come back daily.

create or replace function public.store_visits_summary(p_store_id uuid, p_days int default 7)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_visits int;
  v_uniques int;
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  select count(*)::int,
         count(distinct visitor) filter (where visitor is not null)::int
    into v_visits, v_uniques
    from public.store_visits
   where store_id = p_store_id
     and created_at >= now() - make_interval(days => p_days);

  return jsonb_build_object('visits', coalesce(v_visits, 0),
                            'uniques', coalesce(v_uniques, 0));
end $$;

revoke execute on function public.store_visits_summary(uuid, int) from public, anon;
grant execute on function public.store_visits_summary(uuid, int) to authenticated;
