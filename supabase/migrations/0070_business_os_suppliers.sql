-- Business OS wave 3: suppliers + debt tracking.
-- In Lebanon's cash economy the merchant's supplier ledger ("شو باقي عليي
-- للمورّد") is kept by hand. Model it as suppliers + a two-kind transaction
-- ledger: purchases raise what you owe, payments lower it. Balance is always
-- computed from the ledger — no denormalized dues to drift.

create table if not exists public.store_suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_suppliers_store_idx
  on public.store_suppliers (store_id, created_at desc);

alter table public.store_suppliers enable row level security;

drop policy if exists store_suppliers_manage on public.store_suppliers;
create policy store_suppliers_manage on public.store_suppliers
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

create table if not exists public.supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  supplier_id uuid not null references public.store_suppliers (id) on delete cascade,
  kind text not null check (kind in ('purchase', 'payment')),
  label text,
  amount numeric(12, 2) not null check (amount > 0),
  happened_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists supplier_transactions_supplier_idx
  on public.supplier_transactions (supplier_id, happened_on desc);
create index if not exists supplier_transactions_store_idx
  on public.supplier_transactions (store_id);

alter table public.supplier_transactions enable row level security;

drop policy if exists supplier_transactions_manage on public.supplier_transactions;
create policy supplier_transactions_manage on public.supplier_transactions
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
