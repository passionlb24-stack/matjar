-- Phase 5 — store reviews and ratings (one review per customer per store).
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  customer_name text,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, customer_id)
);

create index reviews_store_id_idx on public.reviews (store_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

-- Reviews are public (no sensitive data; reviewer name is denormalized).
create policy "reviews_select_public"
  on public.reviews for select
  using (true);

create policy "reviews_insert_own"
  on public.reviews for insert
  with check (auth.uid() = customer_id);

create policy "reviews_update_own"
  on public.reviews for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create policy "reviews_delete_own"
  on public.reviews for delete
  using (auth.uid() = customer_id);

-- Admins can remove abusive reviews.
create policy "reviews_delete_admin"
  on public.reviews for delete
  using (public.is_super_admin());
