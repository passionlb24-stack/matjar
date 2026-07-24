-- Security fix (audit 06): sensitive OS-module tables gated on can_manage_store
-- granted access to ANY staff row regardless of the store_staff.permissions JSON
-- — an "orders-only" staffer could read customer PII, POS sales, expenses, etc.
-- Now gated on staff_can(store, perm): the store OWNER always passes; a staff
-- member needs that specific permission (deny-by-default). Until the staff-
-- manager UI exposes these toggles, these modules are effectively owner-only —
-- the correct secure default.

drop policy if exists store_customers_manage on public.store_customers;
create policy store_customers_manage on public.store_customers
  for all to authenticated
  using (public.staff_can(store_id, 'customers'))
  with check (public.staff_can(store_id, 'customers'));

drop policy if exists pos_sales_manage on public.pos_sales;
create policy pos_sales_manage on public.pos_sales
  for all to authenticated
  using (public.staff_can(store_id, 'pos'))
  with check (public.staff_can(store_id, 'pos'));

drop policy if exists store_expenses_manage on public.store_expenses;
create policy store_expenses_manage on public.store_expenses
  for all to authenticated
  using (public.staff_can(store_id, 'expenses'))
  with check (public.staff_can(store_id, 'expenses'));

drop policy if exists store_suppliers_manage on public.store_suppliers;
create policy store_suppliers_manage on public.store_suppliers
  for all to authenticated
  using (public.staff_can(store_id, 'suppliers'))
  with check (public.staff_can(store_id, 'suppliers'));

drop policy if exists stock_movements_manage on public.stock_movements;
create policy stock_movements_manage on public.stock_movements
  for all to authenticated
  using (public.staff_can(store_id, 'inventory'))
  with check (public.staff_can(store_id, 'inventory'));

drop policy if exists store_tasks_manage on public.store_tasks;
create policy store_tasks_manage on public.store_tasks
  for all to authenticated
  using (public.staff_can(store_id, 'tasks'))
  with check (public.staff_can(store_id, 'tasks'));

drop policy if exists store_classes_manage on public.store_classes;
create policy store_classes_manage on public.store_classes
  for all to authenticated
  using (public.staff_can(store_id, 'classes'))
  with check (public.staff_can(store_id, 'classes'));
