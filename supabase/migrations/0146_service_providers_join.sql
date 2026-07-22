-- Links a service (product) to the provider(s) who deliver it — generalizes the
-- clinic "doctor" idea to every service sector (stylist, technician, trainer,
-- teacher…). Many-to-many: a service can have several providers, a provider
-- several services. When a service has NO rows here, any provider can deliver
-- it (backward compatible).
create table if not exists public.service_providers (
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, doctor_id)
);

create index if not exists service_providers_store_idx on public.service_providers (store_id);
create index if not exists service_providers_doctor_idx on public.service_providers (doctor_id);

alter table public.service_providers enable row level security;

-- Public read: the booking flow filters services by the chosen provider.
create policy service_providers_read on public.service_providers
  for select using (true);

-- Store managers manage the links.
create policy service_providers_manage on public.service_providers
  for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
