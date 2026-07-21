-- Recurring membership / subscription plans for gyms, clubs, and schools. Because
-- Matjar has no payment gateway, "Join now" on a plan opens a pre-filled WhatsApp
-- message to the store rather than charging — the plan is a public price card plus
-- a contact hand-off, not a billing record.
-- Applied to production via Supabase migration `store_membership_plans`.

create table public.store_membership_plans (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,
  name_en     text,
  price       numeric,
  period      text not null default 'monthly',   -- monthly | quarterly | yearly | session
  description text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index store_membership_plans_store_idx on public.store_membership_plans (store_id);

alter table public.store_membership_plans enable row level security;

create policy smp_public_read on public.store_membership_plans
  for select using (true);

create policy smp_manage on public.store_membership_plans
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));
