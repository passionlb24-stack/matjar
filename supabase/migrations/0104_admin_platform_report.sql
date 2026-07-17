-- The platform admin pages (admin/orders, admin/reports) computed their headline
-- figures by fetching EVERY order / order_payment / store / profile into the page
-- and reducing in JS. Past PostgREST's 1000-row default that silently truncates —
-- at scale the platform's collected/refunded/net and order/store counts would read
-- LOW with no error. These RPCs compute every figure server-side (unbounded
-- aggregates) in one round-trip, and are gated to super_admins only.

-- Admin orders reconciliation: platform-wide money movements from the append-only
-- ledger, plus the total order count.
create or replace function public.admin_orders_report()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_collected numeric(14, 2);
  v_refunded numeric(14, 2);
  v_orders int;
begin
  if not public.is_super_admin() then
    raise exception 'not_authorized';
  end if;

  select
    coalesce(sum(amount) filter (where kind = 'payment'), 0),
    coalesce(sum(amount) filter (where kind = 'refund'), 0)
    into v_collected, v_refunded
    from public.order_payments;

  select count(*)::int into v_orders from public.orders;

  return jsonb_build_object(
    'collected', v_collected,
    'refunded', v_refunded,
    'net', v_collected - v_refunded,
    'order_count', v_orders
  );
end $$;

revoke execute on function public.admin_orders_report() from public, anon;
grant execute on function public.admin_orders_report() to authenticated;

-- Admin reports KPIs: platform totals + Pro conversion. Distributions (bars) stay
-- in the page; only the headline counts move here where truncation would corrupt them.
create or replace function public.admin_platform_report()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_orders int;
  v_bookings int;
  v_pro int;
  v_active int;
begin
  if not public.is_super_admin() then
    raise exception 'not_authorized';
  end if;

  select count(*)::int into v_orders from public.orders;
  select count(*)::int into v_bookings from public.bookings;

  select
    count(*) filter (where plan = 'pro')::int,
    count(*) filter (where status = 'active')::int
    into v_pro, v_active
    from public.stores where deleted_at is null;

  return jsonb_build_object(
    'total_orders', v_orders,
    'total_bookings', v_bookings,
    'pro_stores', v_pro,
    'active_stores', v_active,
    'conversion', case when v_active > 0
      then round((v_pro::numeric / v_active) * 100)::int else 0 end
  );
end $$;

revoke execute on function public.admin_platform_report() from public, anon;
grant execute on function public.admin_platform_report() to authenticated;
