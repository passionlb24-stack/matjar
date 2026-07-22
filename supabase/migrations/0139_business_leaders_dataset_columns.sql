-- Business Leaders: extend the directory schema for the curated dataset.
-- Adds editorial/verification/classification columns on top of 0135_business_leaders,
-- plus indexes for sector and featured lookups.
-- (Applied to prod via MCP as migration `business_leaders_dataset_columns`.)

alter table public.business_leaders
  add column if not exists profile_type text,
  add column if not exists headline_en text,
  add column if not exists company text,
  add column if not exists company_en text,
  add column if not exists company_description text,
  add column if not exists company_description_en text,
  add column if not exists bio_en text,
  add column if not exists long_bio text,
  add column if not exists long_bio_en text,
  add column if not exists achievements_en jsonb not null default '[]'::jsonb,
  add column if not exists sector text,
  add column if not exists country text,
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists verification_status text not null default 'needs_review',
  add column if not exists priority text not null default 'medium',
  add column if not exists featured boolean not null default false,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists tags_en jsonb not null default '[]'::jsonb,
  add column if not exists image_status text not null default 'placeholder';

create index if not exists business_leaders_sector_idx on public.business_leaders (sector);
create index if not exists business_leaders_featured_idx on public.business_leaders (featured) where featured;
