-- Deal of the Day: a product an admin/merchant flags for a given date is
-- featured on the home page with a live countdown — a daily reason to return.
alter table public.products add column if not exists deal_date date;
create index if not exists products_deal_date_idx
  on public.products (deal_date) where deal_date is not null;
