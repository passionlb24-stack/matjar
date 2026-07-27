-- 0184: let a merchant see the account email of their own booking/order
-- customers. Email lives in auth.users (not profiles) and isn't otherwise
-- exposed, so this is a tightly-scoped SECURITY DEFINER reader gated by
-- can_manage_store — it only ever returns emails of people who booked or
-- ordered at THAT store.

create or replace function public.store_customer_emails(p_store_id uuid)
returns table (customer_id uuid, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_store(p_store_id) then
    return;
  end if;
  return query
  select distinct u.id, u.email::text
  from auth.users u
  where u.id in (
    select b.customer_id from public.bookings b
      where b.store_id = p_store_id and b.customer_id is not null
    union
    select o.customer_id from public.orders o
      where o.store_id = p_store_id and o.customer_id is not null
  );
end $$;

revoke execute on function public.store_customer_emails(uuid) from public, anon;
grant execute on function public.store_customer_emails(uuid) to authenticated;
