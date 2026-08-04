-- 0211: the customer side of the ledger that already exists for suppliers.
--
-- supplier_transactions (store_id, supplier_id, kind, label, amount, happened_on)
-- has been tracking what the store owes its suppliers since 0100-something. There
-- is no counterpart for what customers owe the store: store_customers is name,
-- phone, notes, status, follow_up_on — a contact card, not an account.
--
-- Most Lebanese shops sell على الدفتر. Today that lives in a paper notebook next
-- to the register, which is the single biggest reason a shop that has a POS still
-- keeps the notebook. Salla, Zid and Shopify all model the customer as a buyer who
-- has already paid; none of them model a running balance.
--
-- Deliberately the same shape as supplier_transactions — same columns, same RLS
-- helper, same absence of updated_at. A ledger line is a fact; it is not edited.

create table if not exists public.customer_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.store_customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null check (kind in ('charge','payment','adjustment')),
  label text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  fx_rate numeric(14,4),
  happened_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.customer_transactions is
  'Customer credit ledger (الدفتر). charge = the customer now owes more, payment = they paid some down, adjustment = a correction. Balance is the running sum, never a stored column.';

create index if not exists customer_tx_store_cust_idx
  on public.customer_transactions (store_id, customer_id, happened_on desc);
create index if not exists customer_tx_order_idx
  on public.customer_transactions (order_id) where order_id is not null;

alter table public.customer_transactions enable row level security;

-- Same permission as store_customers itself — whoever may see the customer may
-- see what they owe.
drop policy if exists customer_transactions_manage on public.customer_transactions;
create policy customer_transactions_manage on public.customer_transactions for all
  using (public.staff_can(store_id, 'customers'))
  with check (public.staff_can(store_id, 'customers'));

-- Reuses the rate snapshot from 0209 — a debt recorded today is a debt at
-- today's rate, not at the rate on the day it is finally settled.
drop trigger if exists customer_tx_stamp_fx on public.customer_transactions;
create trigger customer_tx_stamp_fx before insert on public.customer_transactions
  for each row execute function public.stamp_fx_rate();

-- ── Balances ────────────────────────────────────────────────────────────────
create or replace function public.customer_balance(p_customer_id uuid)
returns numeric language sql stable security definer set search_path to '' as $function$
  select coalesce(sum(
           case t.kind when 'payment' then -t.amount else t.amount end
         ), 0)
  from public.customer_transactions t
  where t.customer_id = p_customer_id
    and public.staff_can(t.store_id, 'customers');
$function$;

-- Only customers with something outstanding — the merchant opens this to see who
-- to chase, not to page through everyone they have ever served.
create or replace function public.store_customer_balances(p_store_id uuid)
returns table (
  customer_id uuid,
  name text,
  phone text,
  balance numeric,
  last_activity date
) language sql stable security definer set search_path to '' as $function$
  select c.id,
         c.name,
         c.phone,
         coalesce(sum(case t.kind when 'payment' then -t.amount else t.amount end), 0),
         max(t.happened_on)
  from public.store_customers c
  left join public.customer_transactions t on t.customer_id = c.id
  where c.store_id = p_store_id
    and public.staff_can(p_store_id, 'customers')
  group by c.id, c.name, c.phone
  having coalesce(sum(case t.kind when 'payment' then -t.amount else t.amount end), 0) <> 0
  order by 4 desc;
$function$;

comment on function public.store_customer_balances is
  'Outstanding balance per customer. Positive = the customer owes the store. Customers who are square are omitted.';

-- ── Writer ──────────────────────────────────────────────────────────────────
create or replace function public.record_customer_transaction(
  p_customer_id uuid,
  p_kind text,
  p_amount numeric,
  p_label text default null,
  p_order_id uuid default null,
  p_happened_on date default null
) returns uuid
language plpgsql security definer set search_path to '' as $function$
declare
  v_store uuid;
  v_id uuid;
begin
  select store_id into v_store from public.store_customers where id = p_customer_id;
  if v_store is null then
    raise exception 'customer not found';
  end if;
  if not public.staff_can(v_store, 'customers') then
    raise exception 'not allowed';
  end if;
  if p_kind not in ('charge','payment','adjustment') then
    raise exception 'kind must be charge, payment or adjustment';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be zero or more';
  end if;

  insert into public.customer_transactions
    (store_id, customer_id, order_id, kind, label, amount, happened_on)
  values
    (v_store, p_customer_id, p_order_id, p_kind, p_label, p_amount,
     coalesce(p_happened_on, current_date))
  returning id into v_id;

  return v_id;
end $function$;
