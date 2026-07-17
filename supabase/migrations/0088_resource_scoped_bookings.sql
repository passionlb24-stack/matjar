-- Resource-scoped bookings. A booking blocked the WHOLE store's time slot, so a
-- clinic with two doctors (or a salon with two chairs) couldn't take two 10:00
-- appointments. Now a booking can point at a doctor, and availability is checked
-- per doctor. Stores with no doctors are unchanged (doctor_id stays null →
-- store-wide slots as before).

alter table public.bookings
  add column doctor_id uuid references public.doctors (id) on delete set null;
create index bookings_doctor_idx on public.bookings (doctor_id);

-- booked_times now takes an optional doctor: given one, it returns only that
-- doctor's taken slots; null keeps the old store-wide behaviour. Drop the old
-- 2-arg signature first so we don't create an ambiguous overload.
drop function if exists public.booked_times(uuid, date);

create or replace function public.booked_times(
  p_store_id uuid,
  p_date date,
  p_doctor_id uuid default null
)
returns setof text
language sql stable security definer set search_path = '' as $$
  select distinct b.requested_time
  from public.bookings b
  where b.store_id = p_store_id
    and b.requested_date = p_date
    and b.requested_time is not null
    and b.status in ('pending', 'accepted', 'scheduled')
    and (p_doctor_id is null or b.doctor_id = p_doctor_id);
$$;
revoke execute on function public.booked_times(uuid, date, uuid) from public, anon;
grant execute on function public.booked_times(uuid, date, uuid) to authenticated;
