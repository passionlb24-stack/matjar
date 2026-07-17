-- Accounting P&L ignored the order_payments money ledger: revenue was just
-- sum(orders.total, non-cancelled) + sum(pos_sales.total), so recording a REFUND
-- in the ledger left revenue/profit unchanged and the P&L overstated earnings
-- (a $100 order + a $100 refund still booked $100). Net refunds out of revenue.
--
-- Refunds live in public.order_payments as rows with kind = 'refund' (the
-- payment_kind enum from 0082); amount is always positive (check amount > 0), so
-- we subtract their sum. Only store_accounting changes here; store_report and the
-- pending-order inclusion rule are intentionally left exactly as-is.
create or replace function public.store_accounting(p_store_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_online numeric(14, 2);
  v_pos numeric(14, 2);
  v_refunds numeric(14, 2);
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
  -- Refunds recorded in the money ledger reduce net online revenue (and thus
  -- profit, which the page derives as revenue - expenses).
  select coalesce(sum(amount) filter (where kind = 'refund'), 0)
    into v_refunds from public.order_payments where store_id = p_store_id;
  select coalesce(sum(amount), 0) into v_exp
    from public.store_expenses where store_id = p_store_id;
  select coalesce(sum(case when kind = 'purchase' then amount else -amount end), 0)
    into v_dues from public.supplier_transactions where store_id = p_store_id;
  return jsonb_build_object(
    'online_revenue', v_online - v_refunds, 'pos_revenue', v_pos,
    'total_expenses', v_exp, 'supplier_dues', v_dues
  );
end $$;

revoke execute on function public.store_accounting(uuid) from public, anon;
grant execute on function public.store_accounting(uuid) to authenticated;
