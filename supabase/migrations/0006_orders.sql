-- Phase 2 — orders and order items.

create type order_status as enum (
  'pending', 'accepted', 'preparing', 'ready',
  'out_for_delivery', 'completed', 'cancelled', 'rejected'
);

create type fulfillment_type as enum ('delivery', 'pickup');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  status order_status not null default 'pending',
  fulfillment fulfillment_type not null default 'delivery',
  customer_note text,
  store_note text,
  address text,
  phone text,
  subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_store_id_idx on public.orders (store_id);
create index orders_customer_id_idx on public.orders (customer_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id),
  name text not null,
  unit_price numeric(12, 2) not null default 0,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_select_customer"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "orders_select_store"
  on public.orders for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = orders.store_id and s.owner_id = auth.uid()
    )
  );

create policy "orders_select_admin"
  on public.orders for select
  using (public.is_super_admin());

create policy "orders_insert_customer"
  on public.orders for insert
  with check (auth.uid() = customer_id);

create policy "orders_update_store"
  on public.orders for update
  using (
    exists (
      select 1 from public.stores s
      where s.id = orders.store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = orders.store_id and s.owner_id = auth.uid()
    )
  );

create policy "order_items_select"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = auth.uid()
          or exists (
            select 1 from public.stores s
            where s.id = o.store_id and s.owner_id = auth.uid()
          )
        )
    )
  );

create policy "order_items_insert"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.customer_id = auth.uid()
    )
  );
