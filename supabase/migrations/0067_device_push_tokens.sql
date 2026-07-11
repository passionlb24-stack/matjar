-- Native push tokens (FCM on Android, APNs on iOS) for the Capacitor app.
-- Separate from push_subscriptions (which holds Web Push / VAPID subscriptions):
-- native devices are addressed by an FCM/APNs registration token instead of a
-- browser endpoint. The backend sender targets a user's devices by these tokens.
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

-- Owners can see and remove their own device rows. Writes go through the
-- register RPC below (which reassigns a token to the current user on conflict —
-- e.g. the same phone signing in as a different account).
create policy device_token_select_own on public.device_push_tokens for select
  using (user_id = (select auth.uid()));
create policy device_token_delete_own on public.device_push_tokens for delete
  using (user_id = (select auth.uid()));

create or replace function public.register_device_token(
  p_token text,
  p_platform text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid platform';
  end if;
  insert into public.device_push_tokens (user_id, token, platform)
  values ((select auth.uid()), p_token, p_platform)
  on conflict (token) do update
    set user_id = (select auth.uid()),
        platform = excluded.platform,
        updated_at = now();
end $$;
revoke execute on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

-- Admin/service reader for the backend FCM/APNs sender (mirrors
-- admin_list_push_subscriptions for Web Push).
create or replace function public.list_user_device_tokens(p_user uuid)
returns table (token text, platform text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.token, t.platform
    from public.device_push_tokens t
    where t.user_id = p_user;
end $$;
revoke execute on function public.list_user_device_tokens(uuid) from public, anon;
grant execute on function public.list_user_device_tokens(uuid) to authenticated;
