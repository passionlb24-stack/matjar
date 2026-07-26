-- Order status EVENTS: every transition is recorded with its timestamp, so the
-- customer sees a real visual timeline ("قيد التحضير 3:42") instead of a bare
-- status word — text-only state was a trust killer. Powers /track (guest, via
-- a phone-checked RPC) and the customer order page (RLS).

create table if not exists public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_idx
  on public.order_status_events (order_id, created_at);

alter table public.order_status_events enable row level security;

-- The order's customer or the store's team can read its history. Guests go
-- through get_guest_order_events below.
create policy "order_events_select" on public.order_status_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_events.order_id
        and (o.customer_id = auth.uid() or public.can_manage_store(o.store_id))
    )
  );
-- No client writes: the trigger below is the only writer.

create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_id, from_status, to_status)
    values (new.id, null, new.status::text);
  elsif new.status is distinct from old.status then
    insert into public.order_status_events (order_id, from_status, to_status)
    values (new.id, old.status::text, new.status::text);
  end if;
  return new;
end $$;

drop trigger if exists orders_log_status_insert on public.orders;
create trigger orders_log_status_insert
  after insert on public.orders
  for each row execute function public.log_order_status();
drop trigger if exists orders_log_status_update on public.orders;
create trigger orders_log_status_update
  after update of status on public.orders
  for each row execute function public.log_order_status();

-- Guest timeline: same phone proof as get_guest_order (0076).
create or replace function public.get_guest_order_events(p_order_id uuid, p_phone text)
returns table (to_status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.to_status, e.created_at
  from public.order_status_events e
  join public.orders o on o.id = e.order_id
  where o.id = p_order_id
    and o.customer_id is null
    and o.phone is not null
    and regexp_replace(o.phone, '[^0-9]', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  order by e.created_at;
$$;
revoke execute on function public.get_guest_order_events(uuid, text) from public;
grant execute on function public.get_guest_order_events(uuid, text) to anon, authenticated;
