-- Database-level backstop against double-booking the same time slot. The client
-- greys out taken slots, but that's advisory (TOCTOU race / direct API). These
-- partial unique indexes make it impossible for an ACTIVE booking to collide:
--   * per-doctor (a doctor can't be in two places at once)
--   * per-resource (a court/room/chair can't be double-booked)
--   * solo appointments with no doctor/resource (single-capacity default)
-- Restaurant reservations (party_size) and group classes (class_id) are
-- excluded — they're intentionally multi-capacity.

create unique index if not exists bookings_no_double_book_doctor
  on public.bookings (store_id, doctor_id, requested_date, requested_time)
  where requested_time is not null and doctor_id is not null
    and status in ('pending', 'accepted', 'scheduled');

create unique index if not exists bookings_no_double_book_resource
  on public.bookings (store_id, resource_id, requested_date, requested_time)
  where requested_time is not null and resource_id is not null
    and status in ('pending', 'accepted', 'scheduled');

create unique index if not exists bookings_no_double_book_solo
  on public.bookings (store_id, requested_date, requested_time)
  where requested_time is not null and doctor_id is null and resource_id is null
    and class_id is null and party_size is null
    and status in ('pending', 'accepted', 'scheduled');
