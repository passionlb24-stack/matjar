-- 0226: take the stock back when a cancelled order is un-cancelled.
--
-- restore_stock_on_cancel adds the quantities back when an order moves into
-- 'cancelled' or 'rejected'. Nothing was watching the other direction, so a
-- merchant who cancelled by mistake and put the order back left the stock
-- permanently inflated by the order's quantity. Do it twice and the catalogue
-- claims twice the goods that exist.
--
-- That mattered more than a rare slip suggests, because until the change
-- alongside this one the status control was a bare <select>: a scroll wheel
-- over a focused control, or a mis-tap in a long list on a phone, committed
-- 'cancelled' with nothing in between. The two together are the fix — ask
-- before cancelling, and make un-cancelling cost what cancelling gave.
--
-- Exactly symmetric with the restore, deliberately: same predicate shape, same
-- variant/product split, same `stock is not null` guard so untracked items stay
-- untracked. No clamp at zero — clamping would make cancel/un-cancel/cancel
-- drift upward again, which is the bug this is fixing. A negative value is the
-- honest reading (goods promised that are not there) and the storefront already
-- treats anything <= 0 as sold out.
--
-- Verified on production inside a rolled-back transaction, one product, qty 3:
--   start 7 → order placed 4 → cancelled 7 → un-cancelled 4
-- Step four used to read 7.

create or replace function public.retake_stock_on_reactivate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.status in ('cancelled', 'rejected')
     and new.status not in ('cancelled', 'rejected') then
    update public.products p
       set stock = p.stock - oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.variant_id is null
       and p.id = oi.product_id and p.stock is not null;
    update public.product_variants v
       set stock = v.stock - oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.variant_id = v.id
       and v.stock is not null;
  end if;
  return new;
end
$function$;

drop trigger if exists orders_retake_stock_on_reactivate on public.orders;
create trigger orders_retake_stock_on_reactivate
  after update on public.orders
  for each row execute function public.retake_stock_on_reactivate();
