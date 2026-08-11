-- Two corrections to what 0248 shipped.
--
-- 1. A refund now raises its credit note by itself. Asking a merchant to
--    remember a second document is asking them to forget it, and the tax
--    consequence of forgetting lands on them, not on us.
--
-- 2. An invoice for an order that was cancelled or refused is a document for a
--    sale that never happened. Everything else stays issuable, because plenty of
--    shops hand over the فاتورة when the goods leave rather than after.
--
-- NOTE: record_order_payment is superseded immediately by 0251, which fixes the
-- refund cap for VAT-exclusive stores. It is left here as written so the history
-- reads in the order it happened.
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

  -- Same transaction as the refund it documents: either both exist or neither
  -- does. A refund without its credit note is a silent tax overstatement.
  if p_kind = 'refund' then
    perform public.issue_credit_note(p_order_id, p_amount, p_note);
  end if;

  return v_id;
end $function$;

create or replace function public.issue_invoice(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_store public.stores%rowtype;
  v_order public.orders%rowtype;
  v_seq integer;
  v_number text;
  v_lines jsonb;
  v_net numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if not public.can_manage_store(v_order.store_id) then
    raise exception 'not allowed';
  end if;
  if v_order.status in ('cancelled', 'rejected') then
    raise exception 'order_not_invoiceable';
  end if;

  select id into v_id
  from public.store_invoices
  where order_id = p_order_id and voided_at is null;
  if v_id is not null then
    return v_id;
  end if;

  select * into v_store from public.stores where id = v_order.store_id for update;

  if coalesce(v_store.legal_name, '') = '' then
    raise exception 'store legal information is incomplete — set legal_name before issuing invoices';
  end if;

  v_seq := v_store.invoice_next_no;
  update public.stores set invoice_next_no = v_seq + 1 where id = v_store.id;

  v_number := coalesce(nullif(v_store.invoice_prefix, ''), upper(coalesce(v_store.short_code, 'INV')))
              || '-' || to_char(now(), 'YYYY')
              || '-' || lpad(v_seq::text, 5, '0');

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', oi.name,
           'qty', oi.quantity,
           'unit_price', oi.unit_price,
           'line_total', round(oi.unit_price * oi.quantity, 2)
         ) order by oi.created_at), '[]'::jsonb)
    into v_lines
  from public.order_items oi
  where oi.order_id = p_order_id;

  v_net := coalesce(v_order.subtotal, 0)
         - coalesce(v_order.discount, 0)
         + coalesce(v_order.delivery_fee, 0);

  if v_store.vat_rate = 0 then
    v_tax := 0;
    v_total := v_net;
  elsif v_store.vat_inclusive then
    v_tax := round(v_net - (v_net / (1 + v_store.vat_rate / 100.0)), 2);
    v_total := v_net;
  else
    v_tax := round(v_net * v_store.vat_rate / 100.0, 2);
    v_total := v_net + v_tax;
  end if;

  insert into public.store_invoices (
    store_id, order_id, seq, number,
    legal_name, tax_no, commercial_reg_no, legal_address,
    customer_name, customer_phone, customer_address,
    currency, fx_rate,
    subtotal, discount, delivery_fee,
    vat_inclusive, tax_rate, tax_amount, total, lines,
    issued_by
  ) values (
    v_store.id, p_order_id, v_seq, v_number,
    v_store.legal_name, v_store.tax_no, v_store.commercial_reg_no, v_store.legal_address,
    v_order.customer_name, v_order.phone, v_order.address,
    coalesce(v_order.currency, 'USD'), v_order.fx_rate,
    coalesce(v_order.subtotal, 0), coalesce(v_order.discount, 0), coalesce(v_order.delivery_fee, 0),
    v_store.vat_inclusive, v_store.vat_rate, v_tax, v_total, v_lines,
    auth.uid()
  ) returning id into v_id;

  update public.orders
  set tax_rate = v_store.vat_rate, tax_amount = v_tax
  where id = p_order_id;

  return v_id;
end $function$;
