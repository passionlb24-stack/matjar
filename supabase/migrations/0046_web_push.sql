-- Web Push subscriptions (deal of the day, order updates…). Each row is one
-- browser subscription owned by a user. Sending happens server-side with the
-- VAPID private key; the admin broadcast reads all subs via a SECURITY DEFINER
-- RPC so the route needs no service-role key.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy push_sub_select_own on public.push_subscriptions for select
  using (user_id = (select auth.uid()));
create policy push_sub_insert_own on public.push_subscriptions for insert
  with check (user_id = (select auth.uid()));
create policy push_sub_delete_own on public.push_subscriptions for delete
  using (user_id = (select auth.uid()));

create or replace function public.admin_list_push_subscriptions()
returns table (endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select s.endpoint, s.p256dh, s.auth from public.push_subscriptions s;
end $$;
revoke execute on function public.admin_list_push_subscriptions() from public, anon;
grant execute on function public.admin_list_push_subscriptions() to authenticated;
