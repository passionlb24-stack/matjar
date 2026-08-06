-- 0227: a cancelled order should not spend a coupon use.
--
-- bump_coupon_use increments coupons.used_count when the order is inserted, and
-- raises coupon_used_up once max_uses is reached. Nothing ever decremented it.
-- So a merchant running "50 uses" watched the allowance drain on orders that
-- were rejected for being out of stock, or cancelled by the customer a minute
-- later — and once used_count hit max_uses the code was dead for everyone,
-- including the customers who never got an order out of it.
--
-- Both directions, for the same reason stock got both in 0226: with only a
-- decrement, cancel → un-cancel → cancel would hand back a use that was never
-- returned to the customer, and the count would drift down instead of up.
--
-- greatest(used_count - 1, 0) on the way down guards the one case that is not
-- symmetric: rows that predate this trigger, or a count edited by hand, must
-- not be driven negative.
--
-- Verified on production inside a rolled-back transaction:
--   start 0 → order placed 1 → cancelled 0 → un-cancelled 1

create or replace function public.sync_coupon_use_on_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_cancelled_before boolean; v_cancelled_now boolean;
begin
  if new.coupon_code is null or new.coupon_code = '' then
    return new;
  end if;

  v_cancelled_before := old.status in ('cancelled', 'rejected');
  v_cancelled_now    := new.status in ('cancelled', 'rejected');

  if v_cancelled_now and not v_cancelled_before then
    update public.coupons
       set used_count = greatest(used_count - 1, 0), updated_at = now()
     where store_id = new.store_id and code = new.coupon_code;
  elsif v_cancelled_before and not v_cancelled_now then
    update public.coupons
       set used_count = used_count + 1, updated_at = now()
     where store_id = new.store_id and code = new.coupon_code;
  end if;

  return new;
end
$function$;

drop trigger if exists orders_sync_coupon_use on public.orders;
create trigger orders_sync_coupon_use
  after update on public.orders
  for each row execute function public.sync_coupon_use_on_status();
