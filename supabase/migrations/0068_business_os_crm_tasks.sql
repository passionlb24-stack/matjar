-- Business OS wave 1: a real merchant CRM book + a lightweight task list.
-- Both are sector-neutral core modules (restaurant, clinic, shop, services…).
-- Access follows the store_expenses pattern: owner + permitted staff via
-- can_manage_store().

-- The merchant's customer book. Separate from platform accounts: most walk-in
-- customers in Lebanon have no Matjar account, so the merchant records them
-- here (name/phone/notes). Order-derived stats stay computed from orders.
create table if not exists public.store_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  status text not null default 'new'
    check (status in ('new', 'regular', 'vip', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_customers_store_idx
  on public.store_customers (store_id, created_at desc);
-- One book entry per phone per store (when a phone is recorded).
create unique index if not exists store_customers_store_phone_key
  on public.store_customers (store_id, phone)
  where phone is not null;

alter table public.store_customers enable row level security;

drop policy if exists store_customers_manage on public.store_customers;
create policy store_customers_manage on public.store_customers
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Lightweight tasks & reminders ("call customer", "restock", "pay supplier").
create table if not exists public.store_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  due_on date,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  status text not null default 'open'
    check (status in ('open', 'done')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_tasks_store_idx
  on public.store_tasks (store_id, status, due_on);

alter table public.store_tasks enable row level security;

drop policy if exists store_tasks_manage on public.store_tasks;
create policy store_tasks_manage on public.store_tasks
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
