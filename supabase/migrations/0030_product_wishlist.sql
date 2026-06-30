-- Customers save individual products to buy later (vs. favorites = whole stores).
create table if not exists public.wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists wishlist_product_id_idx on public.wishlist(product_id);

alter table public.wishlist enable row level security;

create policy wishlist_select_own on public.wishlist
  for select to authenticated using (user_id = auth.uid());
create policy wishlist_insert_own on public.wishlist
  for insert to authenticated
  with check (user_id = auth.uid() and public.user_is_active());
create policy wishlist_delete_own on public.wishlist
  for delete to authenticated using (user_id = auth.uid());
