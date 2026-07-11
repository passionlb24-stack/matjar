-- Delivery marketplace. Admin onboards delivery companies (after an agreement);
-- merchants opt their store into the couriers they work with and set a price;
-- customers see the store's delivery options. Solves the biggest small-merchant
-- pain (no own delivery) without any payment integration.
--
-- Policies are split per-command (no FOR ALL over a public SELECT) to avoid
-- reintroducing multiple_permissive_policies advisor findings.

create table if not exists public.delivery_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  phone text,
  whatsapp text,
  coverage text,        -- e.g. "كل لبنان" / regions served
  pricing_note text,    -- e.g. "يبدأ من $3 حسب المنطقة"
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.store_couriers (
  store_id uuid not null references public.stores (id) on delete cascade,
  company_id uuid not null references public.delivery_companies (id) on delete cascade,
  price numeric(12, 2),
  note text,
  created_at timestamptz not null default now(),
  primary key (store_id, company_id)
);
create index if not exists store_couriers_store_idx on public.store_couriers (store_id);

alter table public.delivery_companies enable row level security;
alter table public.store_couriers enable row level security;

-- delivery_companies: public reads active ones; admins manage.
drop policy if exists delivery_companies_select on public.delivery_companies;
create policy delivery_companies_select on public.delivery_companies
  for select to public using (is_active or public.is_super_admin());
drop policy if exists delivery_companies_insert_admin on public.delivery_companies;
create policy delivery_companies_insert_admin on public.delivery_companies
  for insert to authenticated with check (public.is_super_admin());
drop policy if exists delivery_companies_update_admin on public.delivery_companies;
create policy delivery_companies_update_admin on public.delivery_companies
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists delivery_companies_delete_admin on public.delivery_companies;
create policy delivery_companies_delete_admin on public.delivery_companies
  for delete to authenticated using (public.is_super_admin());

-- store_couriers: public reads (shown on the store page); merchant manages own.
drop policy if exists store_couriers_select on public.store_couriers;
create policy store_couriers_select on public.store_couriers
  for select to public using (true);
drop policy if exists store_couriers_insert on public.store_couriers;
create policy store_couriers_insert on public.store_couriers
  for insert to authenticated with check (public.can_manage_store(store_id));
drop policy if exists store_couriers_update on public.store_couriers;
create policy store_couriers_update on public.store_couriers
  for update to authenticated using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
drop policy if exists store_couriers_delete on public.store_couriers;
create policy store_couriers_delete on public.store_couriers
  for delete to authenticated using (public.can_manage_store(store_id));
