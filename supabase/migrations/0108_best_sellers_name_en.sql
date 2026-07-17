-- Bilingual best-sellers: the /en teasers localize product names via name_en, but
-- get_best_sellers (0031) never returned it, so the best-sellers surfaces stayed
-- Arabic on /en. Add name_en to the return table + select. Adding a column changes
-- the return type, which CREATE OR REPLACE can't do, so drop then recreate.
drop function if exists public.get_best_sellers(integer);

create or replace function public.get_best_sellers(p_limit integer default 12)
returns table(
  id uuid, name text, name_en text, price numeric, discount_price numeric,
  image_url text, store_id uuid, store_name text, sold bigint
)
language sql
stable
security definer
set search_path to ''
as $function$
  select p.id, p.name, p.name_en, p.price, p.discount_price, p.image_url,
         p.store_id, s.name, sum(oi.quantity)::bigint
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  join public.stores s on s.id = p.store_id
  where p.status = 'active' and p.is_available and p.deleted_at is null
    and s.status = 'active' and s.deleted_at is null
  group by p.id, p.name, p.name_en, p.price, p.discount_price, p.image_url, p.store_id, s.name
  order by sum(oi.quantity) desc
  limit greatest(p_limit, 1);
$function$;
