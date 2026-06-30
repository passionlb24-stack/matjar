-- Section 7 — flexible per-sector product attributes (rooms, year, mileage…).
alter table public.products
  add column attributes jsonb not null default '{}'::jsonb;
