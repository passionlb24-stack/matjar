-- Fuzzy PRODUCT search (name + price + store), for both the /search results page
-- and the store browser's inline "matching products" section.
--
-- The /search page already renders products with prices, but its query was a
-- plain ILIKE substring on the Arabic name only — so a close/misspelled term or
-- an English name returned nothing. This RPC matches products by name OR name_en,
-- via ILIKE substring (index-backed by the 0080 pg_trgm GIN index) OR a trigram
-- similarity > 0.2 so "close" spellings surface. It returns the full product card
-- (id/name/name_en/price/discount + image + store) ranked by best match, and the
-- store_id so callers can also derive which stores carry a match.
--
-- SECURITY DEFINER + empty search_path so it reads products regardless of the
-- caller's RLS, BUT it hard-filters to active/available/non-deleted products of
-- active/non-deleted stores — hidden/draft/deleted products never leak. Reads no
-- per-user data, so execute is public (anon + authenticated). Queries under 2
-- chars return nothing (avoids scanning the whole catalog).
create or replace function public.search_products_fuzzy(p_q text)
returns table (
  id uuid,
  name text,
  name_en text,
  price numeric,
  discount_price numeric,
  image_url text,
  store_id uuid,
  store_name text,
  rank real
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select btrim(coalesce(p_q, '')) as term
  )
  select
    p.id, p.name, p.name_en, p.price, p.discount_price, p.image_url,
    p.store_id, s.name as store_name,
    case
      when p.name ilike '%' || (select term from q) || '%'
        or coalesce(p.name_en, '') ilike '%' || (select term from q) || '%'
      then 1.0::real
      else greatest(
        public.similarity(p.name, (select term from q)),
        public.similarity(coalesce(p.name_en, ''), (select term from q))
      )
    end as rank
  from public.products p
  join public.stores s on s.id = p.store_id
  where length((select term from q)) >= 2
    and p.status = 'active'
    and p.is_available = true
    and p.deleted_at is null
    and s.status = 'active'
    and s.deleted_at is null
    and (
      p.name ilike '%' || (select term from q) || '%'
      or coalesce(p.name_en, '') ilike '%' || (select term from q) || '%'
      or public.similarity(p.name, (select term from q)) > 0.2
      or public.similarity(coalesce(p.name_en, ''), (select term from q)) > 0.2
    )
  order by rank desc, p.id
  limit 30;
$$;

revoke execute on function public.search_products_fuzzy(text) from public;
grant execute on function public.search_products_fuzzy(text) to anon, authenticated;
