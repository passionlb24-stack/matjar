-- 0197: Scale-readiness indexes from the reliability audit (MJ-D02 / MJ-D03).
-- Purely additive: covering indexes for foreign keys that lacked one (faster
-- joins + avoids parent-delete lock escalation as tables grow) plus the
-- merchant-orders composite. Zero behavior change; negligible write cost at
-- current volume. Safe to run anytime.

-- ── FK covering indexes ──────────────────────────────────────────────────────
create index if not exists booking_waitlist_product_idx on public.booking_waitlist (product_id);
create index if not exists booking_waitlist_doctor_idx on public.booking_waitlist (doctor_id);
create index if not exists bundle_items_product_idx on public.bundle_items (product_id);
create index if not exists course_enrollments_course_idx on public.course_enrollments (course_id);
create index if not exists event_tickets_customer_idx on public.event_tickets (customer_id);
create index if not exists lead_activities_actor_idx on public.lead_activities (actor_id);
create index if not exists leads_customer_idx on public.leads (customer_id);
create index if not exists leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;
create index if not exists leads_product_idx on public.leads (product_id);
create index if not exists orders_delivery_zone_idx on public.orders (delivery_zone_id) where delivery_zone_id is not null;
create index if not exists provider_avail_exc_store_idx on public.provider_availability_exceptions (store_id);
create index if not exists provider_avail_rules_store_idx on public.provider_availability_rules (store_id);
create index if not exists stay_bookings_customer_idx on public.stay_bookings (customer_id);
create index if not exists stock_waitlist_user_idx on public.stock_waitlist (user_id);
create index if not exists stock_waitlist_store_idx on public.stock_waitlist (store_id);
create index if not exists store_memberships_plan_idx on public.store_memberships (plan_id);
create index if not exists store_visits_product_fk_idx on public.store_visits (product_id) where product_id is not null;

-- ── Merchant-orders composite (filter store+status, sort recent) ─────────────
create index if not exists orders_store_status_created_idx
  on public.orders (store_id, status, created_at desc);
