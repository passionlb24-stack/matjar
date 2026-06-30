-- Section 4 — richer store profile: opening hours + social links.
alter table public.stores
  add column opening_hours text,
  add column instagram text,
  add column facebook text,
  add column website text;
