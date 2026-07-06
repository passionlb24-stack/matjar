-- Let a customer cancel their own order/booking. SECURITY DEFINER RPCs (not an
-- RLS UPDATE policy) so the customer cannot tamper with other columns. The
-- stock-restore trigger fires when an order flips to 'cancelled'.
create or replace function public.cancel_my_order(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orders
     set status = 'cancelled', updated_at = now()
   where id = p_id and customer_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'cannot_cancel' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

create or replace function public.cancel_my_booking(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.bookings
     set status = 'cancelled', updated_at = now()
   where id = p_id and customer_id = auth.uid()
     and status in ('pending','accepted','scheduled');
  if not found then
    raise exception 'cannot_cancel' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.cancel_my_booking(uuid) from public, anon;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
