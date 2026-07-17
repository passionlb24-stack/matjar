-- Revenue split: realized vs pending.
-- Until now both the reports RPC and the accounting P&L counted every
-- non-cancelled/non-rejected order as revenue — including orders still
-- pending/accepted/preparing that may never be fulfilled. That overstates
-- realized earnings. Rather than silently redefine the headline (which would
-- make a merchant's revenue appear to drop), this is ADDITIVE: the existing
-- gross figure stays, and each RPC now ALSO returns the completed-only
-- "realized" revenue and the in-progress "pending" revenue, so the UI can lead
-- with realized and show pending beside it — hiding nothing.
--
--   realized = status = 'completed'  (the same state loyalty accrual keys on)
--   pending  = status in (pending, accepted, preparing, ready, out_for_delivery)
--   (cancelled / rejected stay excluded from every figure)
--
-- store_report keeps online_sales (gross = realized + pending); store_accounting
-- keeps online_revenue (gross, net of refunds). Both gain online_realized (net
-- of refunds where refunds apply) + online_pending. Everything else is identical
-- to 0087 (store_report) / 0106 (store_accounting, refund-netting).

create or replace function public.store_report(p_store_id uuid, p_days int default 14)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_total_orders int;
  v_online numeric(14, 2);
  v_realized numeric(14, 2);
  v_pending numeric(14, 2);
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
         coalesce(sum(total) filter (where status not in ('cancelled', 'rejected')), 0),
         coalesce(sum(total) filter (where status = 'completed'), 0),
         coalesce(sum(total) filter (where status not in ('cancelled', 'rejected', 'completed')), 0)
    into v_total_orders, v_online, v_realized, v_pending
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
    'online_realized', v_realized,
    'online_pending', v_pending,
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

-- Accounting P&L: same additive split, on top of the 0106 refund-netting.
create or replace function public.store_accounting(p_store_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_online numeric(14, 2);
  v_realized numeric(14, 2);
  v_pending numeric(14, 2);
  v_pos numeric(14, 2);
  v_refunds numeric(14, 2);
  v_exp numeric(14, 2);
  v_dues numeric(14, 2);
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  select coalesce(sum(total) filter (where status not in ('cancelled', 'rejected')), 0),
         coalesce(sum(total) filter (where status = 'completed'), 0),
         coalesce(sum(total) filter (where status not in ('cancelled', 'rejected', 'completed')), 0)
    into v_online, v_realized, v_pending
    from public.orders where store_id = p_store_id;
  select coalesce(sum(total), 0) into v_pos
    from public.pos_sales where store_id = p_store_id;
  -- Refunds recorded in the money ledger reduce net online revenue (and thus
  -- profit). They apply to fulfilled orders, so net them from both the gross and
  -- the realized figure.
  select coalesce(sum(amount) filter (where kind = 'refund'), 0)
    into v_refunds from public.order_payments where store_id = p_store_id;
  select coalesce(sum(amount), 0) into v_exp
    from public.store_expenses where store_id = p_store_id;
  select coalesce(sum(case when kind = 'purchase' then amount else -amount end), 0)
    into v_dues from public.supplier_transactions where store_id = p_store_id;
  return jsonb_build_object(
    'online_revenue', v_online - v_refunds,
    'online_realized', v_realized - v_refunds,
    'online_pending', v_pending,
    'pos_revenue', v_pos,
    'total_expenses', v_exp, 'supplier_dues', v_dues
  );
end $$;

revoke execute on function public.store_accounting(uuid) from public, anon;
grant execute on function public.store_accounting(uuid) to authenticated;
