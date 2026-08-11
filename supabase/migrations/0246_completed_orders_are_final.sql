-- A finished order stays finished.
--
-- The merchant's status control was a flat dropdown of all eight statuses and
-- the table accepted any of them from any other, so an order that had been
-- delivered, paid for, and reviewed could be moved to "ملغى" — which then fired
-- every cancel trigger in turn: stock back on the shelf for meat that had left
-- the shop, loyalty points reversed, the sale removed from the day's takings.
--
-- It is also how a merchant could answer a bad review. Posting a store review
-- requires a completed order (has_store_purchase), so cancelling the completed
-- order takes that right away from the customer who used it.
--
-- delivery_requests has had "only moves forward, delivered is final" since it
-- was written. Orders never got the same rule. This is that rule, kept to the
-- one edge that actually destroys something: after 'completed', only an admin
-- moves it. Cancelling by mistake stays reversible (0226 exists for exactly
-- that) — it is finishing that cannot be taken back.
create or replace function public.guard_order_status_transition()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  -- Any other column may move freely; this only cares about status.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Server-side paths (SECURITY DEFINER RPCs, service role) carry their own
  -- rules — cancel_my_order already refuses anything past 'pending'.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- An admin fixing a genuine mistake is the escape hatch, and orders_log_status
  -- records who did it.
  if public.is_super_admin() then
    return new;
  end if;

  if old.status = 'completed' then
    raise exception 'order_completed_is_final'
      using errcode = '42501',
            hint = 'A completed order can no longer be changed.';
  end if;

  return new;
end
$function$;

drop trigger if exists orders_guard_status_transition on public.orders;
create trigger orders_guard_status_transition
before update on public.orders
for each row execute function public.guard_order_status_transition();
