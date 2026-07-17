-- Reports were computed by fetching EVERY order / order_item / pos_sale /
-- pos_sale_item into the page and reducing in JS. Past PostgREST's 1000-row
-- default that silently truncates — a busy store's revenue would read LOW with
-- no error. This RPC computes every figure server-side (unbounded aggregates),
-- so the report is correct at any scale and is one round-trip.
create or replace function public.store_report(p_store_id uuid, p_days int default 14)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_total_orders int;
  v_online numeric(14, 2);
  v_pos numeric(14, 2);
  v_cur int;
  v_prev int;
  v_week jsonb;
  v_month jsonb;
  v_per_day jsonb;
  v_status jsonb;
  v_top jsonb;
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  select count(*)::int,
         coalesce(sum(total) filter (where status not in ('cancelled', 'rejected')), 0)
    into v_total_orders, v_online
    from public.orders where store_id = p_store_id;

  select coalesce(sum(total), 0) into v_pos
    from public.pos_sales where store_id = p_store_id;

  -- Order-count windows: current period vs the one before it (for the % delta).
  select count(*)::int into v_cur from public.orders
    where store_id = p_store_id and created_at >= now() - make_interval(days => 7);
  select count(*)::int into v_prev from public.orders
    where store_id = p_store_id
      and created_at >= now() - make_interval(days => 14)
      and created_at < now() - make_interval(days => 7);
  v_week := jsonb_build_object('count', v_cur, 'pct',
    case when v_prev > 0 then round(((v_cur - v_prev)::numeric / v_prev) * 100)::int
         when v_cur > 0 then 100 else 0 end);

  select count(*)::int into v_cur from public.orders
    where store_id = p_store_id and created_at >= now() - make_interval(days => 30);
  select count(*)::int into v_prev from public.orders
    where store_id = p_store_id
      and created_at >= now() - make_interval(days => 60)
      and created_at < now() - make_interval(days => 30);
  v_month := jsonb_build_object('count', v_cur, 'pct',
    case when v_prev > 0 then round(((v_cur - v_prev)::numeric / v_prev) * 100)::int
         when v_cur > 0 then 100 else 0 end);

  -- Per-day unified revenue + order count for the last p_days days.
  select coalesce(jsonb_agg(
           jsonb_build_object('day', d.day, 'orders', d.orders,
                              'online', d.online, 'pos', d.pos)
           order by d.day), '[]'::jsonb)
    into v_per_day
  from (
    select gs::date as day,
      (select count(*)::int from public.orders o
         where o.store_id = p_store_id
           and (o.created_at at time zone 'UTC')::date = gs::date) as orders,
      (select coalesce(sum(total), 0) from public.orders o
         where o.store_id = p_store_id
           and o.status not in ('cancelled', 'rejected')
           and (o.created_at at time zone 'UTC')::date = gs::date) as online,
      (select coalesce(sum(total), 0) from public.pos_sales p
         where p.store_id = p_store_id
           and (p.created_at at time zone 'UTC')::date = gs::date) as pos
    from generate_series(
      (now() at time zone 'UTC')::date - (p_days - 1),
      (now() at time zone 'UTC')::date,
      interval '1 day'
    ) gs
  ) d;

  -- Status breakdown.
  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', c)), '[]'::jsonb)
    into v_status
  from (
    select status::text as status, count(*)::int as c
    from public.orders where store_id = p_store_id group by status
  ) s;

  -- Best sellers across both channels (online items + POS lines).
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty)), '[]'::jsonb)
    into v_top
  from (
    select name, sum(q)::int as qty
    from (
      select oi.name, oi.quantity as q
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.store_id = p_store_id
      union all
      select pi.name, pi.qty as q
        from public.pos_sale_items pi
        join public.pos_sales p on p.id = pi.sale_id
        where p.store_id = p_store_id
    ) u
    group by name
    order by qty desc
    limit 8
  ) t;

  return jsonb_build_object(
    'total_orders', v_total_orders,
    'online_sales', v_online,
    'pos_total', v_pos,
    'week', v_week,
    'month', v_month,
    'per_day', v_per_day,
    'status_rows', v_status,
    'top_products', v_top
  );
end $$;

revoke execute on function public.store_report(uuid, int) from public, anon;
grant execute on function public.store_report(uuid, int) to authenticated;

-- Same truncation risk on the accounting P&L (revenue / expenses / supplier
-- dues were reduced from full row fetches). Aggregate server-side.
create or replace function public.store_accounting(p_store_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_online numeric(14, 2);
  v_pos numeric(14, 2);
  v_exp numeric(14, 2);
  v_dues numeric(14, 2);
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  select coalesce(sum(total) filter (where status not in ('cancelled', 'rejected')), 0)
    into v_online from public.orders where store_id = p_store_id;
  select coalesce(sum(total), 0) into v_pos
    from public.pos_sales where store_id = p_store_id;
  select coalesce(sum(amount), 0) into v_exp
    from public.store_expenses where store_id = p_store_id;
  select coalesce(sum(case when kind = 'purchase' then amount else -amount end), 0)
    into v_dues from public.supplier_transactions where store_id = p_store_id;
  return jsonb_build_object(
    'online_revenue', v_online, 'pos_revenue', v_pos,
    'total_expenses', v_exp, 'supplier_dues', v_dues
  );
end $$;

revoke execute on function public.store_accounting(uuid) from public, anon;
grant execute on function public.store_accounting(uuid) to authenticated;
