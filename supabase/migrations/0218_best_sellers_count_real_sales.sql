-- 0218: rank best-sellers on sales that actually happened.
--
-- get_best_sellers joined order_items → products → stores and never touched
-- public.orders at all. With no reference to the order, it could not see the
-- one column that decides whether a sale happened: there was no status filter
-- and no time window, so a cancelled or rejected order counted exactly as much
-- as a delivered one, for ever.
--
-- Confirmed against production before the change. The four orders on the
-- platform include one rejected order, and it was putting two products on the
-- public list on the strength of a sale that never took place:
--
--   old: MARTADEL 30 · صابون الكركم 2 · صابون الجفتي 1 · صابون زبدة الشيا 1
--   new: MARTADEL 30 · صابون زبدة الشيا 1
--
-- Two of the four entries were fictional, at four orders of real volume.
--
-- That is also the abuse shape: /ar/best-sellers is linked from the header and
-- the home page, and the cheapest way onto it was a self-placed guest order for
-- quantity 999, cancelled a second later, ranking first for ever at zero cost.
-- Market integrity does not repair after it is dirty, so this lands before the
-- store count grows rather than after.
--
-- `not in ('cancelled','rejected')` rather than `= 'completed'`: an accepted or
-- preparing order is real demand that simply has not been handed over yet, and
-- on a platform this young, waiting for completion would empty a public page
-- that has to look alive. The 90-day window is what stops a single early order
-- from anchoring the list permanently — every current order falls inside it, so
-- nothing visible is lost today.
--
-- Self-ordering is still possible and is not addressed here; excluding orders a
-- store placed on itself needs a customer-identity rule that does not exist yet.

create or replace function public.get_best_sellers(p_limit integer default 12)
returns table(id uuid, name text, name_en text, price numeric, discount_price numeric,
              image_url text, store_id uuid, store_name text, sold bigint)
language sql stable security definer set search_path to ''
as $function$
  select p.id, p.name, p.name_en, p.price, p.discount_price, p.image_url,
         p.store_id, s.name, sum(oi.quantity)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  join public.stores s on s.id = p.store_id
  where o.status not in ('cancelled', 'rejected')
    and o.created_at >= now() - interval '90 days'
    and p.status = 'active' and p.is_available and p.deleted_at is null
    and s.status = 'active' and s.deleted_at is null
  group by p.id, p.name, p.name_en, p.price, p.discount_price, p.image_url, p.store_id, s.name
  order by sum(oi.quantity) desc
  limit greatest(p_limit, 1);
$function$;
