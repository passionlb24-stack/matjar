-- Custom pages CMS: the super admin can publish arbitrary content pages
-- (announcements, policies, campaigns) served at /[lang]/p/[slug], without a
-- code deploy. Existing bespoke marketing pages are untouched.
create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_en text not null default '',
  body text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_pages enable row level security;
drop policy if exists site_pages_select_public on public.site_pages;
create policy site_pages_select_public on public.site_pages
  for select to public using (published = true);
drop policy if exists site_pages_admin_all on public.site_pages;
create policy site_pages_admin_all on public.site_pages
  for all to authenticated
  using (public.admin_can('pages')) with check (public.admin_can('pages'));

-- Deals curation: let section-'deals' admins end/adjust a flash sale on any
-- store's product (moderation of the platform-wide flash/clearance surfaces).
drop policy if exists products_admin_update_deals on public.products;
create policy products_admin_update_deals on public.products
  for update to authenticated
  using (public.admin_can('deals')) with check (public.admin_can('deals'));
