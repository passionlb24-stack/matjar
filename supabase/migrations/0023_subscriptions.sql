-- Real subscription system: plans catalog, per-store subscriptions with expiry,
-- and a manual payments ledger. stores.plan stays the fast "current plan" flag.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  price_monthly numeric(12,2) not null default 0,
  price_yearly numeric(12,2),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans (slug, name_ar, name_en, price_monthly, price_yearly, sort_order)
values
  ('free', 'مجاني', 'Free', 0, 0, 0),
  ('pro', 'Matjar Pro', 'Matjar Pro', 12, 120, 1)
on conflict (slug) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan text not null default 'pro',
  status text not null default 'active' check (status in ('active','expired','cancelled','pending')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_store_id_idx on public.subscriptions(store_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  method text not null default 'manual',
  period text not null default 'monthly' check (period in ('monthly','yearly')),
  reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists payments_store_id_idx on public.payments(store_id);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Plans: public reads active ones; admins manage.
create policy plans_select_public on public.plans
  for select using (is_active or public.is_super_admin());
create policy plans_write_admin on public.plans
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

-- Subscriptions & payments: a store's managers read their own; admins do all.
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (
    public.is_super_admin() or public.can_manage_store(store_id)
  );
create policy subscriptions_write_admin on public.subscriptions
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

create policy payments_select on public.payments
  for select to authenticated using (
    public.is_super_admin() or public.can_manage_store(store_id)
  );
create policy payments_write_admin on public.payments
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());
