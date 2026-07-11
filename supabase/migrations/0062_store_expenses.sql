-- Merchant accounting: expense tracking so a store can see true profit
-- (revenue from orders − expenses). High value in a cash economy where
-- merchants keep books by hand. Owner + permitted staff manage their own
-- store's expenses; can_manage_store() is already used in RLS elsewhere.

create table if not exists public.store_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null default 0,
  category text,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists store_expenses_store_idx
  on public.store_expenses (store_id, spent_on);

alter table public.store_expenses enable row level security;

drop policy if exists store_expenses_manage on public.store_expenses;
create policy store_expenses_manage on public.store_expenses
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
