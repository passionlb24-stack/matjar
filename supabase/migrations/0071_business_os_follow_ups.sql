-- Business OS wave 4 (sector deep packs): follow-up reminders on the CRM book.
-- Born for clinics ("remind the patient in 6 months") but useful to every
-- sector, so it lives on store_customers rather than a healthcare-only table.
alter table public.store_customers
  add column if not exists follow_up_on date;

create index if not exists store_customers_follow_up_idx
  on public.store_customers (store_id, follow_up_on)
  where follow_up_on is not null;
