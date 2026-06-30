-- Public "best sellers" feed. order_items is RLS-protected, so aggregate it in a
-- SECURITY DEFINER function that returns only public product info + a sold count
-- (no customer data), for active products of active stores.
create or replace function public.get_best_sellers(p_limit integer default 12)
returns table(
  id uuid, name text, price numeric, discount_price numeric,
  image_url text, store_id uuid, store_name text, sold bigint
)
language sql
stable
security definer
set search_path to ''
as $function$
  select p.id, p.name, p.price, p.discount_price, p.image_url,
         p.store_id, s.name, sum(oi.quantity)::bigint
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  join public.stores s on s.id = p.store_id
  where p.status = 'active' and p.is_available and p.deleted_at is null
    and s.status = 'active' and s.deleted_at is null
  group by p.id, p.name, p.price, p.discount_price, p.image_url, p.store_id, s.name
  order by sum(oi.quantity) desc
  limit greatest(p_limit, 1);
$function$;
