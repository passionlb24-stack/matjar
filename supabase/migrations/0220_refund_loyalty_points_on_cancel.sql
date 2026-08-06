-- 0220: give redeemed loyalty points back when the order is cancelled.
--
-- Checkout writes the redemption as a negative ledger row —
-- `(user_id, -points, 'redeem', store_id, order_id)` — and nothing anywhere
-- ever wrote the matching positive one. Searching every migration for 'redeem'
-- returns only negative inserts. So a customer who spent 2,000 points on a $20
-- discount and had the order rejected because the item was out of stock ended
-- up with no order and no points, and no function in the database could give
-- them back without hand-written SQL.
--
-- The strongest evidence that this was an oversight rather than a policy: the
-- trigger sitting right beside this one, restore_stock_on_cancel, fires on
-- exactly the same condition — `new.status in ('cancelled','rejected') and old
-- not in (...)` — and restores both product and variant stock. The merchant's
-- inventory was always made whole. Only the customer's points were not.
--
-- loyalty_balance() is `sum(delta)` straight off the ledger, with no cached
-- column anywhere, so one compensating row is the entire fix.
--
-- Idempotent twice over: the status precondition means a second UPDATE that
-- lands on an already-cancelled order does nothing, and the redeem_refund
-- existence check means even a replayed or manually re-fired trigger cannot pay
-- the points out a second time.
--
-- Verified on production inside a rolled-back transaction: redeeming 500 points
-- against a live order and then cancelling it returned the balance to its
-- starting 178 and left a single +500 'redeem_refund' row.
--
-- Not addressed here, deliberately: points EARNED on an order that is completed
-- and later cancelled are still kept. Clawing those back can drive a balance
-- negative if they have already been spent elsewhere, so it needs a policy
-- decision about what a negative balance means, not just a trigger.

create or replace function public.refund_loyalty_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_spent integer;
begin
  if new.status in ('cancelled', 'rejected')
     and old.status not in ('cancelled', 'rejected') then

    -- Negative when this order redeemed points; zero when it did not.
    select coalesce(sum(delta), 0) into v_spent
      from public.loyalty_ledger
     where order_id = new.id and reason = 'redeem';

    if v_spent < 0 and not exists (
         select 1 from public.loyalty_ledger
          where order_id = new.id and reason = 'redeem_refund') then

      insert into public.loyalty_ledger (user_id, delta, reason, store_id, order_id, note)
      select l.user_id, -v_spent, 'redeem_refund', l.store_id, new.id,
             'order ' || new.status::text
        from public.loyalty_ledger l
       where l.order_id = new.id and l.reason = 'redeem'
       limit 1;
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists orders_refund_loyalty_on_cancel on public.orders;
create trigger orders_refund_loyalty_on_cancel
  after update on public.orders
  for each row execute function public.refund_loyalty_on_cancel();
