-- Money going back has to leave a document too.
--
-- 0248 made tax invoices real, and a real invoice is a VAT declaration. A refund
-- recorded after one is issued used to touch nothing: the shop handed money back
-- and still owed the state tax on the full amount. The fix is not to edit the
-- invoice — an issued invoice must never change — it is to issue the opposite
-- document against it.
--
-- Its own table and its own counter, deliberately. store_invoices is unique on
-- (store_id, seq) and on order_id while live, so credit notes sharing it would
-- either collide or punch gaps in the invoice series — and a gap in that series
-- is exactly what an inspector asks about.
create table if not exists public.store_credit_notes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  invoice_id uuid not null references public.store_invoices(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  seq integer not null,
  number text not null,
  reason text,
  -- The refund as the customer experiences it (gross), split the way the
  -- invoice was: net back to sales, tax back off the declaration.
  net numeric(12, 2) not null,
  tax_rate numeric(5, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id) on delete set null,
  unique (store_id, seq),
  unique (store_id, number),
  constraint store_credit_notes_positive check (total > 0)
);

create index if not exists store_credit_notes_store_idx
  on public.store_credit_notes (store_id, issued_at desc);
create index if not exists store_credit_notes_invoice_idx
  on public.store_credit_notes (invoice_id);

alter table public.stores
  add column if not exists credit_note_next_no integer not null default 1;

alter table public.store_credit_notes enable row level security;

drop policy if exists store_credit_notes_select on public.store_credit_notes;
create policy store_credit_notes_select on public.store_credit_notes
  for select using (public.can_manage_store(store_id) or public.is_super_admin());

-- No insert/update/delete policy on purpose: these are written only by the
-- SECURITY DEFINER path below, the same way invoices are.

create or replace function public.issue_credit_note(
  p_order_id uuid,
  p_amount numeric,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inv public.store_invoices%rowtype;
  v_store public.stores%rowtype;
  v_already numeric(12, 2);
  v_net numeric(12, 2);
  v_tax numeric(12, 2);
  v_seq integer;
  v_id uuid;
begin
  select * into v_inv from public.store_invoices
  where order_id = p_order_id and voided_at is null;
  -- No invoice, nothing to credit. A refund on an uninvoiced order is just a
  -- payment record, which is correct.
  if not found then
    return null;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'bad_amount';
  end if;

  select coalesce(sum(total), 0) into v_already
  from public.store_credit_notes where invoice_id = v_inv.id;
  if v_already + p_amount > v_inv.total then
    raise exception 'exceeds_invoice';
  end if;

  -- The refund is gross either way: it is what left the till. Splitting it back
  -- out is the same arithmetic whether the invoice quoted VAT inclusive or on
  -- top, because both end at the same gross figure.
  v_tax := case when coalesce(v_inv.tax_rate, 0) = 0 then 0
                else round(p_amount - (p_amount / (1 + v_inv.tax_rate / 100.0)), 2)
           end;
  v_net := round(p_amount - v_tax, 2);

  select * into v_store from public.stores where id = v_inv.store_id for update;
  v_seq := v_store.credit_note_next_no;
  update public.stores set credit_note_next_no = v_seq + 1 where id = v_store.id;

  insert into public.store_credit_notes (
    store_id, invoice_id, order_id, seq, number, reason,
    net, tax_rate, tax_amount, total, issued_by
  ) values (
    v_inv.store_id, v_inv.id, p_order_id, v_seq,
    'CN-' || coalesce(nullif(v_store.invoice_prefix, ''),
                      upper(coalesce(v_store.short_code, 'INV')))
          || '-' || to_char(now(), 'YYYY')
          || '-' || lpad(v_seq::text, 5, '0'),
    nullif(btrim(p_reason), ''),
    v_net, coalesce(v_inv.tax_rate, 0), v_tax, p_amount,
    auth.uid()
  ) returning id into v_id;

  return v_id;
end
$function$;
