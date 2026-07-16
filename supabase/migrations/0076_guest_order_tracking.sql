-- Guest order tracking: a guest (no account) places an order and, until now,
-- had no way to check its status once the confirmation closed. Expose a
-- SECURITY DEFINER lookup that returns an order's status ONLY when the caller
-- supplies both the order id and the matching phone — and only for guest
-- orders (customer_id is null). Signed-in customers use /orders instead.
create or replace function public.get_guest_order(
  p_order_id uuid,
  p_phone text
) returns table (
  status text,
  total numeric,
  fulfillment text,
  created_at timestamptz,
  store_name text
)
language sql stable security definer set search_path = '' as $$
  select o.status::text, o.total, o.fulfillment::text, o.created_at, s.name
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id
    and o.customer_id is null
    and o.phone is not null
    and regexp_replace(o.phone, '[^0-9]', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
$$;
revoke execute on function public.get_guest_order(uuid, text) from public;
grant execute on function public.get_guest_order(uuid, text) to anon, authenticated;
