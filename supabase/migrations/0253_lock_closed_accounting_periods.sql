-- Books you have already reported on must stop moving.
--
-- Expenses, supplier transactions and stock movements were editable and
-- deletable forever, by anyone with store access, with no trace. So a figure a
-- merchant declared in March could quietly become a different figure in June,
-- and nothing in the system would disagree with either version. That is fine
-- while a shop is one person; it stops being fine the moment there is staff, an
-- accountant, or a tax filing.
--
-- books_locked_until is a date the owner moves forward when a period is closed.
-- On or before it, those rows cannot be written, changed or removed. Deliberately
-- not a full double-entry ledger — this is the one property of one that a small
-- shop actually needs: the past holds still.
alter table public.stores
  add column if not exists books_locked_until date;

create or replace function public.guard_locked_books()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_store uuid;
  v_when date;
  v_lock date;
begin
  -- Which store and which date this row belongs to, per table.
  if tg_table_name = 'store_expenses' then
    v_store := coalesce(new.store_id, old.store_id);
    v_when  := coalesce(new.spent_on, old.spent_on);
  elsif tg_table_name = 'supplier_transactions' then
    v_store := coalesce(new.store_id, old.store_id);
    v_when  := coalesce(new.happened_on, old.happened_on);
  else -- stock_movements
    v_store := coalesce(new.store_id, old.store_id);
    v_when  := coalesce(new.created_at, old.created_at)::date;
  end if;

  select books_locked_until into v_lock from public.stores where id = v_store;
  if v_lock is null or v_when is null or v_when > v_lock then
    return coalesce(new, old);
  end if;

  -- The owner set this lock; an admin is the only way back through it, and the
  -- audit log records that they did.
  if public.is_super_admin() then
    return coalesce(new, old);
  end if;

  raise exception 'books_locked'
    using errcode = '42501',
          hint = 'This period is closed. Move the lock date to reopen it.';
end
$function$;

drop trigger if exists store_expenses_locked on public.store_expenses;
create trigger store_expenses_locked
before insert or update or delete on public.store_expenses
for each row execute function public.guard_locked_books();

drop trigger if exists supplier_transactions_locked on public.supplier_transactions;
create trigger supplier_transactions_locked
before insert or update or delete on public.supplier_transactions
for each row execute function public.guard_locked_books();

drop trigger if exists stock_movements_locked on public.stock_movements;
create trigger stock_movements_locked
before insert or update or delete on public.stock_movements
for each row execute function public.guard_locked_books();

-- Only the owner closes a period. Staff writes to the column are silently
-- reverted the same way every other guarded column on stores behaves (0217).
create or replace function public.guard_books_lock_column()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if new.books_locked_until is not distinct from old.books_locked_until then
    return new;
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  if auth.uid() is distinct from old.owner_id then
    new.books_locked_until := old.books_locked_until;
    return new;
  end if;
  return new;
end
$function$;

drop trigger if exists stores_guard_books_lock on public.stores;
create trigger stores_guard_books_lock
before update on public.stores
for each row execute function public.guard_books_lock_column();
