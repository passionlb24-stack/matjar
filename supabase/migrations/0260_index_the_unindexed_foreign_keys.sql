-- Twenty foreign keys with nothing behind them, seven of which I added this week.
--
-- Two costs. A join or a "show me this person's rows" filter scans the whole
-- child table, and — the one that bites unexpectedly — every delete of a parent
-- row has to scan each child table to enforce the constraint. Deleting one store
-- today touches a handful of rows and nobody notices; the point of fixing it
-- while there are 31 stores is that nobody ever has to notice.
--
-- Cheap and reversible, so there is no reason to wait for the pain.
create index if not exists content_reports_reporter_idx      on public.content_reports (reporter_id);
create index if not exists content_reports_resolved_by_idx   on public.content_reports (resolved_by);
create index if not exists craft_providers_area_idx          on public.craft_providers (area_id);
create index if not exists craft_requests_area_idx           on public.craft_requests (area_id);
create index if not exists craft_reviews_customer_idx        on public.craft_reviews (customer_id);
create index if not exists customer_transactions_created_by_idx on public.customer_transactions (created_by);
create index if not exists customer_transactions_customer_idx  on public.customer_transactions (customer_id);
create index if not exists delivery_requests_created_by_idx  on public.delivery_requests (created_by);
create index if not exists employee_advances_store_idx       on public.employee_advances (store_id);
create index if not exists fx_rates_created_by_idx           on public.fx_rates (created_by);
create index if not exists payroll_lines_employee_idx        on public.payroll_lines (employee_id);
create index if not exists payroll_runs_created_by_idx       on public.payroll_runs (created_by);
create index if not exists payroll_runs_expense_idx          on public.payroll_runs (expense_id);
create index if not exists payroll_runs_posted_by_idx        on public.payroll_runs (posted_by);
create index if not exists product_imports_created_by_idx    on public.product_imports (created_by);
create index if not exists search_logs_user_idx              on public.search_logs (user_id);
create index if not exists store_credit_notes_issued_by_idx  on public.store_credit_notes (issued_by);
create index if not exists store_credit_notes_order_idx      on public.store_credit_notes (order_id);
create index if not exists store_employees_user_idx          on public.store_employees (user_id);
create index if not exists store_invoices_issued_by_idx      on public.store_invoices (issued_by);
