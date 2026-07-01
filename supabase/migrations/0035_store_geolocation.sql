-- Store geolocation for "nearest to you" discovery. Merchants set it (via the
-- browser's location or manual entry); buyers sort by distance client-side.
alter table public.stores
  add column if not exists lat numeric(9,6),
  add column if not exists lng numeric(9,6);
