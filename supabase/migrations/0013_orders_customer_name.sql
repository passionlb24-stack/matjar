-- Section 4 — denormalize the customer's name onto orders for the merchant
-- customers view (profiles names aren't readable cross-user under RLS).
alter table public.orders add column customer_name text;
