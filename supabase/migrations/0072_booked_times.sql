-- Booking conflict awareness: expose ONLY the taken time strings for a store
-- on a given date (no customer data), so the booking form can warn before a
-- customer requests an already-taken slot. SECURITY DEFINER because customers
-- can't (and shouldn't) read other people's booking rows.
create or replace function public.booked_times(p_store_id uuid, p_date date)
returns setof text
language sql stable security definer set search_path = '' as $$
  select distinct b.requested_time
  from public.bookings b
  where b.store_id = p_store_id
    and b.requested_date = p_date
    and b.requested_time is not null
    and b.status in ('pending', 'accepted', 'scheduled');
$$;
revoke execute on function public.booked_times(uuid, date) from public, anon;
grant execute on function public.booked_times(uuid, date) to authenticated;
