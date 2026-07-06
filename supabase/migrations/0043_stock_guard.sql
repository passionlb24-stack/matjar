-- Prevent overselling: reserve product stock atomically at order placement and
-- give it back if the order is cancelled/rejected. NULL stock = unlimited.
-- Runs as triggers (owner context) since customers cannot UPDATE products.

create or replace function public.decrement_product_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.products
     set stock = stock - new.quantity
   where id = new.product_id and (stock is null or stock >= new.quantity);
  if not found then
    raise exception 'insufficient_stock' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists order_items_decrement_stock on public.order_items;
create trigger order_items_decrement_stock
  after insert on public.order_items
  for each row execute function public.decrement_product_stock();

create or replace function public.restore_stock_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelled','rejected')
     and old.status not in ('cancelled','rejected') then
    update public.products p
       set stock = p.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and p.id = oi.product_id and p.stock is not null;
  end if;
  return new;
end $$;
drop trigger if exists orders_restore_stock_on_cancel on public.orders;
create trigger orders_restore_stock_on_cancel
  after update on public.orders
  for each row execute function public.restore_stock_on_cancel();

revoke execute on function public.decrement_product_stock() from public, anon, authenticated;
revoke execute on function public.restore_stock_on_cancel() from public, anon, authenticated;
