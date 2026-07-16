-- Money ledger: audit found money lived only in orders.total — no way to record
-- what was actually collected or refunded, so no refunds, no reconciliation, no
-- disputes. This adds an append-only ledger of payment/refund movements per
-- order. Writes go only through a SECURITY DEFINER RPC that re-checks authority
-- and caps amounts server-side (never trust the client).

create type public.payment_kind as enum ('payment', 'refund');

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  kind public.payment_kind not null,
  amount numeric(12, 2) not null check (amount > 0),
  method text,
  note text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index order_payments_order_idx on public.order_payments (order_id);
create index order_payments_store_idx on public.order_payments (store_id);

alter table public.order_payments enable row level security;

-- Read: whoever manages the store, admins, and the order's own customer.
create policy order_payments_select on public.order_payments for select
  using (
    public.can_manage_store(store_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );
-- No insert/update/delete policies: under RLS that denies all direct writes.
-- The RPC below is the only writer (it is SECURITY DEFINER).

-- Record a payment or refund against an order. Server-validated: caller must
-- manage the store (or be admin); payments can't exceed the order total and
-- refunds can't exceed it either. Ledger is append-only (no edits/deletes).
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_kind text,
  p_amount numeric,
  p_method text default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_store_id uuid;
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_refunded numeric(12, 2);
  v_id uuid;
begin
  select store_id, total into v_store_id, v_total
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
  if p_kind = 'refund' and v_refunded + p_amount > v_total then
    raise exception 'exceeds_total';
  end if;

  insert into public.order_payments
    (order_id, store_id, kind, amount, method, note, actor_id)
  values (
    p_order_id, v_store_id, p_kind::public.payment_kind, p_amount,
    nullif(trim(p_method), ''), nullif(trim(p_note), ''), auth.uid()
  )
  returning id into v_id;
  return v_id;
end; $$;

revoke execute on function
  public.record_order_payment(uuid, text, numeric, text, text)
  from public, anon;
grant execute on function
  public.record_order_payment(uuid, text, numeric, text, text)
  to authenticated;
