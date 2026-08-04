-- 0212: an invoice a merchant can hand to their accountant.
--
-- stores already carries commercial_reg_no and commercial_reg_verified — the
-- Chamber of Commerce verification put them there. What is missing is everything
-- downstream of them: the legal identity that has to be printed, a VAT rate, a
-- tax line on the order, and an invoice record that survives being audited.
--
-- Three properties make this an invoice rather than a receipt:
--   1. Gapless per store. The sequence is handed out under a row lock on stores,
--      so two concurrent issues cannot take the same number.
--   2. Immutable. Once issued it cannot be edited or deleted — only voided, with
--      a reason. An invoice that can be edited is not evidence of anything.
--   3. Self-contained. The legal name, register number and line items are copied
--      onto the invoice, not referenced. Renaming the store next year must not
--      rewrite last year's invoices.
--
-- VAT is a per-store setting defaulting to 0, never a constant. Lebanon's rate has
-- changed before and applies to some merchants and not others.
--
-- ⚠ This is the data model. Have an accountant approve a printed sample against
--   current Lebanese requirements before exposing it to merchants.

-- ── 1. Legal identity ───────────────────────────────────────────────────────
alter table public.stores add column if not exists legal_name text;
alter table public.stores add column if not exists tax_no text;
alter table public.stores add column if not exists legal_address text;
alter table public.stores add column if not exists vat_rate numeric(5,2) not null default 0
  check (vat_rate >= 0 and vat_rate <= 100);
alter table public.stores add column if not exists vat_inclusive boolean not null default true;
alter table public.stores add column if not exists invoice_prefix text;
alter table public.stores add column if not exists invoice_next_no integer not null default 1
  check (invoice_next_no >= 1);

comment on column public.stores.vat_inclusive is
  'true = listed prices already contain VAT and the tax is extracted from the total; false = VAT is added on top. Lebanese shops do both.';

-- ── 2. Tax line on the order ────────────────────────────────────────────────
alter table public.orders add column if not exists tax_rate numeric(5,2) not null default 0;
alter table public.orders add column if not exists tax_amount numeric(12,2) not null default 0;

-- ── 3. The invoice ──────────────────────────────────────────────────────────
create table if not exists public.store_invoices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  seq integer not null,
  number text not null,

  -- copied, not referenced: the store may be renamed, these may not change
  legal_name text not null,
  tax_no text,
  commercial_reg_no text,
  legal_address text,

  customer_name text,
  customer_phone text,
  customer_address text,

  currency text not null default 'USD',
  fx_rate numeric(14,4),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  vat_inclusive boolean not null default true,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  lines jsonb not null default '[]'::jsonb,

  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  void_reason text,

  unique (store_id, seq),
  unique (store_id, number)
);

create index if not exists store_invoices_store_idx
  on public.store_invoices (store_id, issued_at desc);

-- One live invoice per order; a voided one leaves room for a reissue.
create unique index if not exists store_invoices_active_order_idx
  on public.store_invoices (order_id)
  where voided_at is null and order_id is not null;

alter table public.store_invoices enable row level security;

-- Read/void through the store. Inserts go only through issue_invoice() — there is
-- deliberately no path that lets a client choose its own invoice number.
drop policy if exists store_invoices_select_store on public.store_invoices;
create policy store_invoices_select_store on public.store_invoices for select
  using (public.can_manage_store(store_id));

-- ── 4. Immutability ─────────────────────────────────────────────────────────
create or replace function public.guard_invoice_immutable()
returns trigger language plpgsql set search_path to '' as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'an issued invoice cannot be deleted — void it instead';
  end if;
  if (to_jsonb(new) - 'voided_at' - 'void_reason')
     is distinct from
     (to_jsonb(old) - 'voided_at' - 'void_reason') then
    raise exception 'an issued invoice is immutable — only voided_at and void_reason may change';
  end if;
  if old.voided_at is not null then
    raise exception 'this invoice is already voided';
  end if;
  return new;
end $function$;

drop trigger if exists store_invoices_immutable on public.store_invoices;
create trigger store_invoices_immutable
  before update or delete on public.store_invoices
  for each row execute function public.guard_invoice_immutable();

-- ── 5. Issue ────────────────────────────────────────────────────────────────
create or replace function public.issue_invoice(p_order_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $function$
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

  -- Idempotent: issuing twice returns the invoice that already exists.
  select id into v_id
  from public.store_invoices
  where order_id = p_order_id and voided_at is null;
  if v_id is not null then
    return v_id;
  end if;

  -- The lock is the whole point — it is what makes the sequence gapless.
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

  -- Keep the order consistent with the document that was issued against it.
  update public.orders
  set tax_rate = v_store.vat_rate, tax_amount = v_tax
  where id = p_order_id;

  return v_id;
end $function$;

comment on function public.issue_invoice is
  'Issues a gapless, immutable invoice for an order. Idempotent. The sequence is allocated under a row lock on stores.';

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_store uuid;
begin
  select store_id into v_store from public.store_invoices where id = p_invoice_id;
  if v_store is null then
    raise exception 'invoice not found';
  end if;
  if not public.can_manage_store(v_store) then
    raise exception 'not allowed';
  end if;
  if coalesce(p_reason, '') = '' then
    raise exception 'a void reason is required';
  end if;

  update public.store_invoices
  set voided_at = now(), void_reason = p_reason
  where id = p_invoice_id;
end $function$;
