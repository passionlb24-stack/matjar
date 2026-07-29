# 06 — Database Audit

_Checkpoint 0. Evidence = live read-only inspection of the production Supabase DB (`pg_class`, `pg_stat_user_tables`, `pg_indexes`, `pg_constraint`) + 194 migration files. No mutations. No `EXPLAIN ANALYZE` on production (per safety rules)._

## Current state
- **Data volume is tiny (build/test phase):** stores≈14, products≈25, orders≈0, bookings≈22, notifications≈144, business_leaders≈120. Largest table = `business_leaders` at 464 kB. **The DB is nowhere near a size problem today.** The audit below is about scale readiness.
- **RLS is enabled on every public table** (verified: `relrowsecurity=true` across all 90+ tables).
- The high `seq_scan` counts in `pg_stat_user_tables` (e.g. `profiles` 360k, `stores` 31k) are the planner **correctly** choosing sequential scans on tiny tables — an artifact of small size, not a defect. These flip to index scans automatically as tables grow, **provided the right indexes exist** (assessed below).

## Indexing: mature
The schema reflects many dedicated FK/index migrations (`0033`, `0034`, `0160`, `fk_covering_indexes`, `search_trgm_indexes`). Verified strong coverage:

- **bookings**: unique double-book guards (`bookings_no_double_book_doctor/resource/service`), GIST overlap indexes (`bookings_provider_no_overlap`, `bookings_solo_exclusive_no_overlap`), per-FK indexes, reminder-scan partial index. **Excellent.**
- **stay_bookings**: `stay_no_overlap` GIST daterange exclusion + store/unit composite indexes.
- **orders**: `store_id`, `customer_id`, `location`, `assigned_to` (partial), and `orders_idempotency_key_idx` (unique partial).
- **notifications**: `(user_id, created_at DESC)`.
- **products / stores**: `store_id`, trigram GIN search (`products_name_trgm`, `stores_name_trgm`), flash/deal/featured partials, `stores_slug_unique`, `stores_status_idx`.
- **event_tickets / leads / store_visits**: sensible `(store_id, created_at DESC)` / `(store_id, status)` composites.

## Findings

| ID | Title | Severity | Evidence |
|---|---|---|---|
| DB-01 | Missing unique constraints on memberships/enrollments → enables the CID-01 double-renew race | **High** | `store_memberships`, `course_enrollments` have no `unique(…) where status=active/enrolled` |
| DB-02 | 17 foreign keys without a covering index → slower joins + parent-delete lock escalation at scale | Medium | see list below |
| DB-03 | `orders` lacks a `(store_id, status, created_at DESC)` composite for the merchant-orders query pattern (filter store+status, sort recent) | Medium | `pg_indexes` on orders |
| DB-04 | No table partitioning / archival strategy for the append-only growth tables (orders, order_items, order_events, notifications, store_visits, audit_logs) | Medium (future) | schema review |
| DB-05 | `store_visits` is an unbounded analytics event table with no rollup/retention beyond `store_visits_summary` RPC | Medium (future) | `0161` |
| DB-06 | Heavy reliance on JSONB (`orders.custom_fields`, `products.attributes`, `notifications.data`) — flexible but unindexed; filtering on JSON keys will seq-scan | Low | schema |

### DB-02 — FK-without-covering-index list (17)
`booking_waitlist(product_id, doctor_id)`, `bundle_items(product_id)`, `course_enrollments(course_id)`, `event_tickets(customer_id)`, `lead_activities(actor_id)`, `leads(customer_id, assigned_to, product_id)`, `orders(delivery_zone_id)`, `provider_availability_exceptions(store_id)`, `provider_availability_rules(store_id)`, `stay_bookings(customer_id)`, `stock_waitlist(user_id, store_id)`, `store_memberships(plan_id)`, `store_visits(product_id)`.
Several are on tables shipped this cycle (leads, stay_bookings, event_tickets, store_memberships, course_enrollments). Cheap fix (`create index` each); prioritize `orders.delivery_zone_id`, `leads.assigned_to` ("my leads" filter), and the customer_id FKs.

## Data integrity (structural)
- **Soft deletes**: `deleted_at` present on stores/products; consistently filtered in reads (`is("deleted_at", null)`). Good.
- **Timestamps**: `created_at`/`updated_at` widely present; `updated_at` maintained by triggers/RPCs in most places.
- **Timezone**: `timestamptz` used for order/booking times (verified in RPC signatures) — correct. Date-only stay ranges use `date` (correct for nights).
- **Enums**: `booking_status`, `stay_status`, `fulfillment_type`, `lead_kind/status` — typed enums, not free-text (good). Exception: `add_store_staff.p_role` is free-text (CID-10).
- **Orphans**: FKs with `on delete cascade`/`set null` are declared on the new engines; a full orphan sweep needs data at scale — **marked: needs verification with realistic data.**

## Index recommendations (for `12_SCALABILITY`)
| Table | Columns | Query pattern | Benefit | Cost |
|---|---|---|---|---|
| store_memberships | `unique(plan_id, customer_id) WHERE status='active'` | dedupe active membership | closes CID-01 + fast lookup | tiny |
| course_enrollments | `unique(course_id, customer_id) WHERE status='enrolled'` | dedupe enrollment | closes CID-01 | tiny |
| orders | `(store_id, status, created_at DESC)` | merchant orders list/filter | avoids sort+filter after store scan | small |
| leads | `(assigned_to) WHERE assigned_to IS NOT NULL` | "my leads" | FK + filter | tiny |
| orders | `(delivery_zone_id)` | zone joins / zone deletes | FK covering | tiny |
| (12 more FK indexes per DB-02) | | joins + delete locks | | tiny each |

All are additive, non-breaking, low write-cost. **Do not apply during the audit** — these are Checkpoint 3 items.
