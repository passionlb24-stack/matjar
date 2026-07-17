-- Product-name search for the store browser (/explore).
--
-- The explore listing is public + cached cross-request and filters client-side
-- by STORE name only. This RPC extends search to PRODUCT names: given a query,
-- it returns the ids of active, non-deleted stores that carry an active,
-- available, non-deleted product whose name (or English override) matches —
-- either as a substring (ILIKE, index-backed by the pg_trgm GIN index from
-- migration 0080) or a "close" trigram match (pg_trgm similarity > 0.2), so
-- minor misspellings still surface the store.
--
-- rank = the best match score for the store: 1.0 for a substring hit, else the
-- highest trigram similarity across its matching products. Callers sort desc.
--
-- SECURITY DEFINER + empty search_path so it can read products regardless of the
-- caller's RLS, BUT it hard-filters to active/available/non-deleted products of
-- active/non-deleted stores — hidden/draft/deleted products never leak. It reads
-- no per-user data, so execute is public (anon + authenticated). A trimmed query
-- shorter than 2 chars returns no rows (avoids scanning the whole catalog).
create or replace function public.search_store_ids_by_product(p_q text)
returns table (store_id uuid, rank real)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select btrim(coalesce(p_q, '')) as term
  ),
  matches as (
    select
      p.store_id as sid,
      case
        when p.name ilike '%' || (select term from q) || '%'
          or coalesce(p.name_en, '') ilike '%' || (select term from q) || '%'
        then 1.0::real
        else greatest(
          public.similarity(p.name, (select term from q)),
          public.similarity(coalesce(p.name_en, ''), (select term from q))
        )
      end as score
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
  )
  select sid as store_id, max(score) as rank
  from matches
  group by sid
  order by max(score) desc;
$$;

revoke execute on function public.search_store_ids_by_product(text) from public;
grant execute on function public.search_store_ids_by_product(text) to anon, authenticated;
