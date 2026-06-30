-- Phase 1 — admin roles & moderation policies.

-- Allow backend/service (null auth.uid) and super_admins to change roles;
-- only block self-escalation by signed-in non-admins. Enables bootstrapping
-- the first admin via SQL/service.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

-- Checks if the current user is a super_admin. SECURITY INVOKER: reads only
-- the caller's own profile row (allowed by the profiles_select_own policy),
-- so it avoids RLS recursion without elevated privileges.
create or replace function public.is_super_admin()
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$$;

-- Super admins can read and moderate every store.
create policy "stores_select_admin"
  on public.stores for select
  using (public.is_super_admin());

create policy "stores_update_admin"
  on public.stores for update
  using (public.is_super_admin())
  with check (public.is_super_admin());
