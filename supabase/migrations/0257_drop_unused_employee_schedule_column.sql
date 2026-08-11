-- I added store_employees.schedule in 0254 and then never wrote a line that
-- reads or writes it. Payroll counts real attendance, not an expected roster, so
-- the column has no job — and a column with no job is the same failure I spent
-- this whole run fixing elsewhere: something that looks like a feature until
-- someone relies on it.
--
-- Safe to drop outright: added hours ago, never surfaced in any UI, no rows.
alter table public.store_employees drop column if exists schedule;
