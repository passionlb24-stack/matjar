-- A customer can review a store only after a COMPLETED order or booking with it
-- (previously any order/booking, even pending, qualified). Prevents reviews
-- before the merchant has actually fulfilled anything.
create or replace function public.has_store_purchase(p_uid uuid, p_store uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.orders
    where customer_id = p_uid and store_id = p_store and status = 'completed'
  ) or exists (
    select 1 from public.bookings
    where customer_id = p_uid and store_id = p_store and status = 'completed'
  );
$$;
