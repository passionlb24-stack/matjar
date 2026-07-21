-- Business Leaders directory (Hub). Premium profiles of Lebanese entrepreneurs.
-- Cold-start-safe: rows are unpublished by default and only super admins can
-- publish, so the public directory only ever shows curated/verified profiles
-- (never fabricated data). Authenticated users may SUBMIT their own unpublished
-- profile for review.
-- Applied to production via Supabase migration `business_leaders`.

create table public.business_leaders (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  name_en      text,
  headline     text,
  bio          text,
  photo_url    text,
  cover_url    text,
  website      text,
  location     text,
  socials      jsonb not null default '{}'::jsonb,
  companies    jsonb not null default '[]'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  published    boolean not null default false,
  sort_order   integer not null default 0,
  submitted_by uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index business_leaders_pub_idx on public.business_leaders (published, sort_order);

alter table public.business_leaders enable row level security;

create policy business_leaders_public_read on public.business_leaders
  for select using (published = true);
create policy business_leaders_submit on public.business_leaders
  for insert to authenticated
  with check (submitted_by = auth.uid() and published = false);
create policy business_leaders_admin on public.business_leaders
  for all using (is_super_admin()) with check (is_super_admin());
