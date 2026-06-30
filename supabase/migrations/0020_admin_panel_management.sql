-- Account suspension flag for the admin Users-management section.
alter table public.profiles
  add column if not exists is_active boolean not null default true;

-- Admins can see every business type (the public policy only exposes active ones)
-- and fully manage them (the catalog of sub-types under each sector).
drop policy if exists business_types_select_admin on public.business_types;
create policy business_types_select_admin on public.business_types
  for select to authenticated using (public.is_super_admin());

drop policy if exists business_types_insert_admin on public.business_types;
create policy business_types_insert_admin on public.business_types
  for insert to authenticated with check (public.is_super_admin());

drop policy if exists business_types_update_admin on public.business_types;
create policy business_types_update_admin on public.business_types
  for update to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists business_types_delete_admin on public.business_types;
create policy business_types_delete_admin on public.business_types
  for delete to authenticated using (public.is_super_admin());

-- Admins can update any profile (e.g. suspend/reactivate via is_active).
-- The existing prevent_role_change trigger still guards role escalation.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());
