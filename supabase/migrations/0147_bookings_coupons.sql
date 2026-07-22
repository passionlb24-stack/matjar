-- Coupons on bookings, mirroring orders. validate_coupon(store, code, amount)
-- is already generic (subtotal-based), so it's reused against the service price.
-- The discount is informational for the pay-on-arrival model (the merchant
-- honors it), and the coupon's used_count is bumped on booking insert.
alter table public.bookings
  add column if not exists coupon_code text,
  add column if not exists discount numeric(12,2) not null default 0;

drop trigger if exists bookings_bump_coupon on public.bookings;
create trigger bookings_bump_coupon
  after insert on public.bookings
  for each row execute function public.bump_coupon_use();
