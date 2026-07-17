-- Order status history. orders.status is a single mutable column with no record
-- of who changed it or when — weak for disputes ("when was it shipped? who
-- cancelled?"). This adds an append-only event log, written by a trigger on
-- every status change so no write path can bypass it.

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

-- Readable by whoever can see the order: the store's managers, admins, and the
-- order's own customer. No direct writes (the trigger is the only writer).
create policy order_events_select on public.order_events for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          public.can_manage_store(o.store_id)
          or public.is_super_admin()
          or o.customer_id = (select auth.uid())
        )
    )
  );

create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, from_status, to_status, actor_id)
    values (new.id, null, new.status::text, new.customer_id);
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, from_status, to_status, actor_id)
    values (new.id, old.status::text, new.status::text, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();
