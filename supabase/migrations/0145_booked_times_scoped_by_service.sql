-- Slot conflicts must be scoped to the PROVIDER (doctor/resource) or, when the
-- booking has no provider, to the specific SERVICE — never blanket per-store.
-- So a clinic can book teeth-cleaning AND a lab test both at 10:00 (different
-- services / providers), while the same service can't be double-booked.

-- Replace the over-strict store-level solo index (0144) with a service-scoped one.
drop index if exists public.bookings_no_double_book_solo;

create unique index if not exists bookings_no_double_book_service
  on public.bookings (store_id, product_id, requested_date, requested_time)
  where requested_time is not null and doctor_id is null and resource_id is null
    and class_id is null and party_size is null and product_id is not null
    and status in ('pending', 'accepted', 'scheduled');

-- Availability scoped the same way: taken = the chosen doctor's booked times,
-- or (no doctor) the chosen service's solo booked times. Adds p_product_id.
drop function if exists public.booked_times(uuid, date, uuid);

create or replace function public.booked_times(
  p_store_id uuid,
  p_date date,
  p_doctor_id uuid default null,
  p_product_id uuid default null
) returns setof text
language sql security definer stable set search_path = '' as $$
  select distinct b.requested_time
  from public.bookings b
  where b.store_id = p_store_id
    and b.requested_date = p_date
    and b.requested_time is not null
    and b.status in ('pending', 'accepted', 'scheduled')
    and (
      (p_doctor_id is not null and b.doctor_id = p_doctor_id)
      or (p_doctor_id is null and p_product_id is not null
          and b.product_id = p_product_id
          and b.doctor_id is null and b.resource_id is null
          and b.class_id is null and b.party_size is null)
    );
$$;

grant execute on function public.booked_times(uuid, date, uuid, uuid) to anon, authenticated;
