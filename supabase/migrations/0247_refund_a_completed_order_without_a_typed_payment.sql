-- Make the refund path reachable.
--
-- 0246 stopped merchants cancelling a completed order, which was the only way
-- they had to undo one. The intended replacement already exists — a refund row
-- in order_payments, which store_accounting already subtracts from revenue —
-- but it was capped at the sum of payments someone had typed in by hand. Across
-- the whole platform that is one row: nobody records a cash-on-delivery payment,
-- because the money arrives at the door, not in the app. So every refund
-- attempt failed with 'exceeds_paid' and cancelling was the only exit left.
--
-- The cap is now what the shop can actually owe. On a completed order that is
-- the order total, whether or not a payment was ever keyed in — the goods were
-- handed over, so the money changed hands. On an order that is not completed
-- yet, the old rule stands: you cannot give back money you never took.
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_kind text,
  p_amount numeric,
  p_method text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_store_id uuid;
  v_total numeric(12, 2);
  v_status text;
  v_paid numeric(12, 2);
  v_refunded numeric(12, 2);
  v_cap numeric(12, 2);
  v_id uuid;
begin
  select store_id, total, status into v_store_id, v_total, v_status
  from public.orders where id = p_order_id;
  if v_store_id is null then raise exception 'order_not_found'; end if;
  if not (public.can_manage_store(v_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_kind not in ('payment', 'refund') then raise exception 'bad_kind'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;

  select
    coalesce(sum(amount) filter (where kind = 'payment'), 0),
    coalesce(sum(amount) filter (where kind = 'refund'), 0)
  into v_paid, v_refunded
  from public.order_payments where order_id = p_order_id;

  if p_kind = 'payment' and v_paid + p_amount > v_total then
    raise exception 'exceeds_total';
  end if;

  if p_kind = 'refund' then
    -- A delivered order was paid for even when no one keyed the payment in.
    v_cap := case when v_status = 'completed'
                  then greatest(v_paid, coalesce(v_total, 0))
                  else v_paid end;
    if v_refunded + p_amount > v_cap then
      raise exception 'exceeds_paid';
    end if;
  end if;

  insert into public.order_payments
    (order_id, store_id, kind, amount, method, note, actor_id)
  values (
    p_order_id, v_store_id, p_kind::public.payment_kind, p_amount,
    nullif(trim(p_method), ''), nullif(trim(p_note), ''), auth.uid()
  )
  returning id into v_id;
  return v_id;
end $function$;
