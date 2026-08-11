-- Surfaced by testing 0249: with VAT charged on top, orders.total is the
-- pre-VAT figure while the invoice — the document the customer holds — totals
-- more. Capping refunds at orders.total therefore refused to give back money
-- the customer had demonstrably paid.
--
-- The invoice wins when there is one. It is the issued, immutable statement of
-- what was owed; the order row is just where it came from.
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
  v_invoiced numeric(12, 2);
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

  select total into v_invoiced from public.store_invoices
  where order_id = p_order_id and voided_at is null;
  v_total := coalesce(v_invoiced, v_total);

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
    v_cap := case when v_status = 'completed' or v_invoiced is not null
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

  -- Same transaction as the refund it documents: either both exist or neither
  -- does. A refund without its credit note is a silent tax overstatement.
  if p_kind = 'refund' then
    perform public.issue_credit_note(p_order_id, p_amount, p_note);
  end if;

  return v_id;
end $function$;
