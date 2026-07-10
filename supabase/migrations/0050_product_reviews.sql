-- Product-level reviews (distinct from store-level reviews) with photos and an
-- auto-computed "verified purchase" flag — the biggest trust gap vs Amazon/Noon.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  photos jsonb not null default '[]'::jsonb,
  customer_name text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, customer_id)
);
create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc);
alter table public.product_reviews enable row level security;

create policy product_reviews_select_public on public.product_reviews
  for select using (true);
create policy product_reviews_insert_own on public.product_reviews
  for insert with check (customer_id = (select auth.uid()) and public.user_is_active());
create policy product_reviews_update_own on public.product_reviews
  for update using (customer_id = (select auth.uid()));
create policy product_reviews_delete_own on public.product_reviews
  for delete using (customer_id = (select auth.uid()) or public.is_super_admin());

create or replace function public.set_product_review_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.verified := exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = new.product_id and o.customer_id = new.customer_id
  );
  return new;
end $$;
drop trigger if exists product_reviews_verified on public.product_reviews;
create trigger product_reviews_verified
  before insert on public.product_reviews
  for each row execute function public.set_product_review_verified();
revoke execute on function public.set_product_review_verified() from public, anon, authenticated;
