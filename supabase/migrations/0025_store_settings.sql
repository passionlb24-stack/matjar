-- Operational store settings (distinct from the profile fields on the edit page).
alter table public.stores
  add column if not exists accepts_delivery boolean not null default true,
  add column if not exists accepts_pickup boolean not null default true,
  add column if not exists min_order numeric(12,2),
  add column if not exists prep_time text,
  add column if not exists payment_note text;
