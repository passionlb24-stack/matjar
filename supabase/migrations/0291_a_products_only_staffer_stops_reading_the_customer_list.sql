-- ISS-002. Migration 0159 re-pointed five Business OS tables from
-- can_manage_store (true for ANY staff row) to staff_can(store_id, perm).
-- Five siblings kept the old predicate, so the permission toggles the owner sets
-- on a staff member did not govern them.
--
-- Demonstrated, not argued. Using the one real staff row in production —
-- permissions {orders:false, bookings:false, products:true} — a seeded
-- checkout_intents row came back in full: customer name AND phone. A person
-- hired to manage products could read the phone number of every customer who
-- abandoned a cart.
--
-- Worth recording how nearly this was missed. My first check queried these
-- tables as that staffer and saw zero rows, and I read that as "RLS is holding".
-- It was not: the tables were simply empty for that store. RLS filters rows
-- silently — it does not raise — so on an empty table "blocked" and "nothing
-- there" are the same answer. Seeding a row first is what separates them, and
-- without it I would have reported this closed.
--
-- Two tables that looked equally exposed turned out safe, and for a reason worth
-- keeping: pos_sale_items and lead_activities gate through a subquery on a parent
-- (pos_sales, leads) that is itself RLS-filtered, so the nested read returns
-- nothing and the child is protected transitively. Reading policy text alone
-- would have called both of them open.
--
-- Choice of predicate per table:
--   checkout_intents, store_invoices -> staff_can(...,'orders'). An abandoned
--     cart and an invoice are order-shaped work; whoever handles orders needs
--     them, and nobody else does.
--   payments, subscriptions -> is_store_owner. What the shop pays Matjar is the
--     owner's business, not an operational permission anyone should hold.
--   supplier_transactions -> staff_can(...,'suppliers'). The toggle already
--     exists in the staff editor and already governs the suppliers table itself;
--     this closes the gap where the parent was governed and the ledger was not.
--
-- Safe against the DEPLOYED build, checked before applying rather than after:
-- checkout_intents is read by no application code at all; the other four are read
-- only by merchant pages that already gate on can_manage_store, and staff_can and
-- is_store_owner both return true for the owner, so the owner's path is unchanged.
-- Verified in a rolled-back transaction: after these policies, the products-only
-- staffer reads 0 checkout_intents while the owner still reads the seeded row.
-- The direction of travel is restricting, which is the direction that breaks live
-- code, which is why the read paths were enumerated first.
--
-- Left as-is deliberately: those merchant pages still let a permission-less staff
-- member LOAD them and see an empty screen, rather than refusing entry. That is a
-- UI change across several pages; the security boundary is here, and it now holds
-- regardless of what the UI does.

drop policy if exists checkout_intents_select on public.checkout_intents;
create policy checkout_intents_select on public.checkout_intents for select
  using (public.staff_can(store_id,'orders') or public.is_super_admin());

drop policy if exists store_invoices_select_store on public.store_invoices;
create policy store_invoices_select_store on public.store_invoices for select
  using (public.staff_can(store_id,'orders') or public.is_super_admin());

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select
  using (public.is_super_admin() or public.is_store_owner(store_id));

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select
  using (public.is_super_admin() or public.is_store_owner(store_id));

drop policy if exists supplier_transactions_manage on public.supplier_transactions;
create policy supplier_transactions_manage on public.supplier_transactions for all
  using (public.staff_can(store_id,'suppliers'))
  with check (public.staff_can(store_id,'suppliers'));
