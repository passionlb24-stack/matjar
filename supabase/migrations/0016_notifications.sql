-- Section 9 — notifications, created automatically by triggers on events.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data)
  select s.owner_id, 'order_new', jsonb_build_object('order_id', new.id)
  from public.stores s where s.id = new.store_id;
  return new;
end; $$;
create trigger orders_notify_new
  after insert on public.orders
  for each row execute function public.notify_new_order();

create or replace function public.notify_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, type, data)
    values (new.customer_id, 'order_status',
            jsonb_build_object('order_id', new.id, 'status', new.status));
  end if;
  return new;
end; $$;
create trigger orders_notify_status
  after update on public.orders
  for each row execute function public.notify_order_status();

create or replace function public.notify_new_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data)
  select s.owner_id, 'booking_new', jsonb_build_object('booking_id', new.id)
  from public.stores s where s.id = new.store_id;
  return new;
end; $$;
create trigger bookings_notify_new
  after insert on public.bookings
  for each row execute function public.notify_new_booking();

create or replace function public.notify_booking_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, type, data)
    values (new.customer_id, 'booking_status',
            jsonb_build_object('booking_id', new.id, 'status', new.status));
  end if;
  return new;
end; $$;
create trigger bookings_notify_status
  after update on public.bookings
  for each row execute function public.notify_booking_status();

revoke execute on function public.notify_new_order() from public, anon, authenticated;
revoke execute on function public.notify_order_status() from public, anon, authenticated;
revoke execute on function public.notify_new_booking() from public, anon, authenticated;
revoke execute on function public.notify_booking_status() from public, anon, authenticated;
