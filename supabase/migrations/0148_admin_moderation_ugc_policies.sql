-- Super-admin moderation for the UGC verticals: jobs, freelance (gigs),
-- wholesale. Until now these tables were owner-only — the platform could not
-- see non-active posts, hide abuse, or remove content. These additive,
-- permissive policies (OR'd with the existing owner policies) give super admins
-- full moderation without changing owner access at all.

-- Jobs -----------------------------------------------------------------
drop policy if exists job_postings_admin_select on public.job_postings;
create policy job_postings_admin_select on public.job_postings
  for select to authenticated using (public.is_super_admin());
drop policy if exists job_postings_admin_update on public.job_postings;
create policy job_postings_admin_update on public.job_postings
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists job_postings_admin_delete on public.job_postings;
create policy job_postings_admin_delete on public.job_postings
  for delete to authenticated using (public.is_super_admin());

-- Freelance (gigs) -----------------------------------------------------
drop policy if exists gigs_admin_select on public.gigs;
create policy gigs_admin_select on public.gigs
  for select to authenticated using (public.is_super_admin());
drop policy if exists gigs_admin_update on public.gigs;
create policy gigs_admin_update on public.gigs
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists gigs_admin_delete on public.gigs;
create policy gigs_admin_delete on public.gigs
  for delete to authenticated using (public.is_super_admin());

-- Wholesale ------------------------------------------------------------
drop policy if exists wholesale_admin_select on public.wholesale_products;
create policy wholesale_admin_select on public.wholesale_products
  for select to authenticated using (public.is_super_admin());
drop policy if exists wholesale_admin_update on public.wholesale_products;
create policy wholesale_admin_update on public.wholesale_products
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists wholesale_admin_delete on public.wholesale_products;
create policy wholesale_admin_delete on public.wholesale_products
  for delete to authenticated using (public.is_super_admin());
