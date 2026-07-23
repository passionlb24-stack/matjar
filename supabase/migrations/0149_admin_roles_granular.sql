-- Granular platform-admin roles. Until now admin access was a single
-- all-or-nothing `super_admin` flag. This adds section-scoped sub-admins
-- WITHOUT weakening anything: super_admin still passes every check (superset),
-- and there are zero sub-admins until one is explicitly granted sections.

alter table public.profiles
  add column if not exists admin_permissions jsonb not null default '[]'::jsonb;

-- admin_can(section): super admins pass everything; a sub-admin passes only the
-- sections listed in their profiles.admin_permissions array. SECURITY DEFINER +
-- empty search_path to avoid RLS recursion (same pattern as is_super_admin).
create or replace function public.admin_can(section text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.role = 'super_admin' or p.admin_permissions ? section)
  );
$$;

-- Any platform admin = super_admin OR holds at least one section permission.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.role = 'super_admin' or jsonb_array_length(p.admin_permissions) > 0)
  );
$$;

-- Guard: only super admins may change admin_permissions. profiles_update lets a
-- user edit their OWN row, so without this a user could self-grant sections.
-- Mirrors the existing prevent_role_change() trigger.
create or replace function public.prevent_admin_perm_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.admin_permissions is distinct from old.admin_permissions
     and not public.is_super_admin() then
    new.admin_permissions := old.admin_permissions;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_prevent_admin_perm on public.profiles;
create trigger profiles_prevent_admin_perm before update on public.profiles
  for each row execute function public.prevent_admin_perm_change();

-- Re-point the UGC moderation policies (from 0148) at admin_can(section) so a
-- sub-admin granted that exact section can moderate it. Super admins unaffected.
drop policy if exists job_postings_admin_select on public.job_postings;
create policy job_postings_admin_select on public.job_postings
  for select to authenticated using (public.admin_can('jobs'));
drop policy if exists job_postings_admin_update on public.job_postings;
create policy job_postings_admin_update on public.job_postings
  for update to authenticated
  using (public.admin_can('jobs')) with check (public.admin_can('jobs'));
drop policy if exists job_postings_admin_delete on public.job_postings;
create policy job_postings_admin_delete on public.job_postings
  for delete to authenticated using (public.admin_can('jobs'));

drop policy if exists gigs_admin_select on public.gigs;
create policy gigs_admin_select on public.gigs
  for select to authenticated using (public.admin_can('freelance'));
drop policy if exists gigs_admin_update on public.gigs;
create policy gigs_admin_update on public.gigs
  for update to authenticated
  using (public.admin_can('freelance')) with check (public.admin_can('freelance'));
drop policy if exists gigs_admin_delete on public.gigs;
create policy gigs_admin_delete on public.gigs
  for delete to authenticated using (public.admin_can('freelance'));

drop policy if exists wholesale_admin_select on public.wholesale_products;
create policy wholesale_admin_select on public.wholesale_products
  for select to authenticated using (public.admin_can('wholesale'));
drop policy if exists wholesale_admin_update on public.wholesale_products;
create policy wholesale_admin_update on public.wholesale_products
  for update to authenticated
  using (public.admin_can('wholesale')) with check (public.admin_can('wholesale'));
drop policy if exists wholesale_admin_delete on public.wholesale_products;
create policy wholesale_admin_delete on public.wholesale_products
  for delete to authenticated using (public.admin_can('wholesale'));
