-- 0160 — Performance advisor fixes: missing foreign-key indexes + one RLS initplan.
--
-- (a) unindexed_foreign_keys: five FK columns had no covering index, so lookups
-- and cascade checks fall back to sequential scans as the tables grow. The most
-- important is products.section_id — the store page groups a catalogue into
-- sections, and that join scans without it. Plain CREATE INDEX (not CONCURRENTLY)
-- because migrations run inside a transaction; the brief lock is acceptable
-- pre-traction on these small tables.
create index if not exists automation_runs_automation_id_idx
  on public.automation_runs (automation_id);
create index if not exists loyalty_ledger_order_id_idx
  on public.loyalty_ledger (order_id);
create index if not exists loyalty_ledger_store_id_idx
  on public.loyalty_ledger (store_id);
create index if not exists order_events_actor_id_idx
  on public.order_events (actor_id);
create index if not exists products_section_id_idx
  on public.products (section_id);

-- (b) auth_rls_initplan: the business_leaders_submit INSERT policy called
-- auth.uid() bare, so Postgres re-evaluated it for every candidate row. Wrapping
-- it in a scalar subquery makes the planner evaluate it once per statement.
alter policy business_leaders_submit on public.business_leaders
  with check ((submitted_by = (select auth.uid())) and (published = false));
