-- Customers can follow stores and get notified when the store adds a product.
create table if not exists public.follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index if not exists follows_store_id_idx on public.follows(store_id);

alter table public.follows enable row level security;

create policy follows_select_own on public.follows
  for select to authenticated using (user_id = auth.uid());
create policy follows_insert_own on public.follows
  for insert to authenticated
  with check (user_id = auth.uid() and public.user_is_active());
create policy follows_delete_own on public.follows
  for delete to authenticated using (user_id = auth.uid());

-- Notify a store's followers when it publishes a new active product.
create or replace function public.notify_followers_new_product()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'active' then
    insert into public.notifications (user_id, type, data)
    select f.user_id, 'store_product',
           jsonb_build_object('store_id', new.store_id, 'product_id', new.id)
    from public.follows f
    where f.store_id = new.store_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists products_notify_followers on public.products;
create trigger products_notify_followers
  after insert on public.products
  for each row execute function public.notify_followers_new_product();
