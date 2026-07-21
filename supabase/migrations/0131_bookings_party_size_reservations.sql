-- Table reservations for the food sector. A reservation is an ordinary booking
-- with a party size (how many people); it lands in the store's existing bookings
-- inbox alongside appointments, so no new table is needed — just the extra column.
-- The public ReservationForm inserts a booking with service_name = "table
-- reservation" and party_size set; the "reservations" feature module gates it.
-- Applied to production via Supabase migration `bookings_party_size_reservations`.

alter table public.bookings
  add column if not exists party_size integer;
