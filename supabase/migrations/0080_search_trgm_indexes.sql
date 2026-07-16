-- Search performance: the unified search does `ilike '%term%'` on store and
-- product names. A leading-wildcard ILIKE can't use a b-tree index, so it was a
-- full scan that degrades as the catalog grows. GIN trigram indexes make these
-- substring searches index-backed. pg_trgm ships with Postgres/Supabase.
create extension if not exists pg_trgm;

create index if not exists idx_stores_name_trgm
  on public.stores using gin (name gin_trgm_ops);

create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);
