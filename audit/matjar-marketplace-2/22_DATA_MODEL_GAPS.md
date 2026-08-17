# 22 — Data Model Gaps

**Scope:** map the entity list the commissioning brief proposes against the tables that
actually exist in production, sorted into EXISTS / PARTIALLY EXISTS / GENUINELY MISSING.
Recommend additive migrations only. Assess the "avoid giant unstructured JSON blobs" concern
against real column usage.

**Verified production baseline** (live `pg_catalog` reads, `wesihatopiznatsyfxer`):

| Metric | Value |
|---|---|
| Base tables in `public` | **119** |
| Views in `public` | **0** |
| Functions in `public` | **436** |
| RLS policies | **289** |
| Applied migrations (`supabase_migrations.schema_migrations`) | **259**, latest `20260815121159` |
| `jsonb`/`json` columns across all tables | **37** |

**Caveat on the brief.** I was given the brief's *themes* (transaction primitives, offering
types, "avoid giant unstructured JSON blobs") rather than a literal enumerated entity list.
The entity list below is therefore reconstructed from those themes plus the standard
marketplace entity set. Where I am inferring rather than quoting, I say so.

---

## 1. Bucket A — EXISTS

These are named, live tables. Nothing needs to be designed.

### Identity, tenancy, catalogue

| Proposed entity | Real table | Live rows | Notes |
|---|---|---|---|
| User / profile | `profiles` | 22 | `platform_role` enum: `super_admin, merchant, customer, driver` |
| Merchant / store | `stores` | 33 | 60 columns; `store_status`, `store_plan` enums |
| Business type / sector | `business_types` | — | joined to the 17 keys in `src/lib/catalog.ts:4-20` |
| Branch / location | `store_locations`, `store_branches` via `stores`+`store_locations` | — | `orders.location_id` FK exists |
| Product / offering | `products` | 65 | see doc 06 |
| Category / section | `store_sections` | 26 | plus `market_categories` |
| Variant | `product_variants` | 6 | `0181_variant_color_size.sql` |
| Option / modifier | `product_options` (3), `product_modifier_groups` (0) | | `0194_food_modifiers.sql` |
| Bundle | `bundle_items` + `products.is_bundle` | — | |
| Address | `addresses` | 3 | |
| Geography | `lb_areas`, `market_regions`, `market_cities` | — | |

### Transaction primitives

| Proposed entity | Real table | Live rows |
|---|---|---|
| Order | `orders` | 7 |
| Order line | `order_items` | — |
| Payment ledger | `order_payments` (`0082`) | — |
| Order audit trail | `order_events`, `order_status_events` (`0173`) | 26 events |
| Appointment | `bookings` | 22 |
| Booking waitlist | `booking_waitlist` (`0178`) | — |
| Lead | `leads`, `lead_activities` (`0190`) | 3 |
| Service request / quote | `service_requests` (`0083`) | 2 |
| Stay / reservation | `stay_bookings` (`0191`) | 2 |
| Accommodation unit | `accommodation_units` (`0191`) | 4 |
| Enrollment | `course_enrollments` (`0192`) | 2 |
| Membership | `store_memberships` (`0192`) | 0 |
| Ticket | `event_tickets` (`0193`) | 0 |
| Classified listing | `listings` (`0036`) | 9 |
| Delivery dispatch | `delivery_requests` (`0213`) | — |
| Abandoned cart | `checkout_intents` (`0120`) | 1 |

### Supporting / operational

`coupons` (1), `loyalty_ledger`, `referrals`, `reviews` (5), `product_reviews` (1),
`product_questions`, `wishlist`, `listing_favorites`, `follows`, `saved_searches`,
`notifications` (231), `push_subscriptions`, `conversations` / `conversation_participants` /
`messages`, `audit_logs` (125), `content_reports`, `listing_reports`, `search_logs`,
`store_visits` (148), `fx_rates`, `plans`, `subscriptions`, `payments`, `store_staff`,
`store_employees`, `employee_attendance` / `_breaks` / `_advances` / `_devices` /
`_enrolments`, `payroll_runs` / `payroll_lines`, `store_expenses`, `store_invoices`,
`store_credit_notes`, `store_suppliers`, `supplier_transactions`, `stock_movements`,
`stock_waitlist`, `product_imports`, `pos_sales` / `pos_sale_items`, `store_tasks`,
`automations` (8) / `automation_runs`, `store_campaigns`, `store_customers` (36),
`customer_transactions`, `store_verifications` / `store_verification_docs`,
`store_delivery_zones`, `store_couriers`, `delivery_companies`, `store_modules` (7),
`store_checkout_fields`, `site_pages`, `app_settings`, `academy_guides`,
`business_leaders` (120), `job_postings` / `job_applications`, `gigs` (3),
`wholesale_products`, `trades` (47) / `trade_groups`, `craft_providers` / `craft_services` /
`craft_works` / `craft_requests` / `craft_reviews` / `craft_provider_areas` /
`craft_provider_trades`, `doctors` (2), `service_providers`,
`provider_availability_rules` / `_exceptions`, `store_resources` (2), `store_classes` (1),
`store_courses` (2), `store_membership_plans`, `event_ticket_types` (0),
`store_portfolio` (0), `webauthn_challenges`, `enrolment_attempts`, `hub_tool_events`.

**Conclusion for bucket A: the platform is not entity-poor. It is entity-rich (119 tables) and
lifecycle-poor.** The recurring shortfall is not "no table" — it is "table with a `text` status
and no transition function". See doc 07 §10.3.

---

## 2. Bucket B — PARTIALLY EXISTS

Each of these has a table, but the table is missing a column or a companion that the domain
requires. All fixes are additive.

### B1. Event — `event_ticket_types` has no event
`event_ticket_types` (`0193`) has `name, price, capacity, sold, active, sort_order`.
It has **no `event_at`, no `venue`, no `doors_open`, no `ends_at`.** A ticket type is not an
event, and a customer cannot be told what they are buying. This is the reason ticketing
cannot go live regardless of UI work.
**Additive fix:** `alter table event_ticket_types add column event_at timestamptz, add column
event_ends_at timestamptz, add column venue text;` — nullable, so existing rows (0 of them)
are unaffected.

### B2. Appointment v2 columns exist but are unwritten
`bookings.starts_at`, `.ends_at`, `.allocation_mode` (`0174_booking_engine.sql`) are
**NULL on all 22 live rows**. Both GiST exclusion constraints
(`bookings_provider_no_overlap`, `bookings_solo_exclusive_no_overlap`) are predicated on
`starts_at IS NOT NULL`, so they currently protect nothing. The entity exists; the data does
not. **This is a backfill + write-path task, not a schema task.** Backfilling
`starts_at = (requested_date + requested_time::time) at time zone 'Asia/Beirut'` is additive
(fills NULLs) but **must be run in a transaction that tolerates `exclusion_violation`** — if
any two existing bookings already overlap, the backfill will fail, which is itself the signal
that a double-booking already happened. Test with `begin; ... rollback;` first.

### B3. Resource and class bookings have no overlap guard
`bookings.resource_id` (6 live rows) and `.class_id` (1 live row) match neither exclusion
constraint's `WHERE` predicate. `store_classes.capacity` is never enforced at write time.
**Additive fix:** two more partial exclusion constraints keyed on `resource_id` and
`(class_id, requested_date)`, plus a `place_resource_booking` / `place_class_booking` RPC so
the check happens inside the write transaction rather than in the browser.

### B4. Guest read-back exists for orders only
`get_guest_order(p_order_id, p_phone)` and `get_guest_order_events` exist. There is no
equivalent for `stay_bookings` or `event_tickets`, both of which accept guest writes and store
`customer_id = NULL`. **Additive fix:** two new `SECURITY DEFINER` read functions; no schema
change at all.

### B5. Status vocabularies are text, not enums
`course_enrollments.status` (`'enrolled'`), `store_memberships.status` (`'active'`),
`event_tickets.status` (`'reserved'`) are `text NOT NULL DEFAULT '...'` with **no CHECK
constraint** (verified against `pg_constraint`). **Additive fix:** add CHECK constraints first
(cheap, reversible, no type change), and only convert to enums later if needed. Do **not**
`ALTER TYPE` these columns as a first move — that is a rewrite on live tables.

### B6. `store_courses` has no capacity and no dates
`name, name_en, description, price, duration text, schedule text, level text, active`.
No `capacity`, no `starts_on`, no `ends_on`, no session list. A course cannot sell out and an
enrollment cannot expire.
**Additive fix:** `add column capacity integer, add column starts_on date, add column ends_on
date;` all nullable.

### B7. `store_resources` availability is two integers
`open_hour int DEFAULT 8`, `close_hour int DEFAULT 24`. No per-weekday hours, no closures, no
per-slot price. Contrast `provider_availability_rules` / `provider_availability_exceptions`,
which model exactly this correctly for `doctors` — and have **0 live rows**, so that pattern is
built but unused too.
**Additive fix:** reuse the existing availability-rules pattern rather than inventing a
third; add `resource_id` as a nullable sibling of `doctor_id`, or add
`resource_availability_rules` mirroring the existing shape.

### B8. No rate calendar for stays
`accommodation_units` has `base_nightly_price` + `weekend_price` only. No seasonal rate, no
per-date override, no blackout table. A hotel cannot close a unit for one week without
deactivating it (which also hides it from `search_stay`).
**Additive fix:** a new `unit_rate_overrides(unit_id, on_date, price, is_blocked)` table.
`search_stay` and `stay_base_total` would need updating — that is a function replace, not a
destructive change.

### B9. `leads.status = 'scheduled'` has nothing to schedule
No `scheduled_at`, no FK to `bookings`. A real-estate viewing cannot land on a calendar.
**Additive fix:** `alter table leads add column scheduled_at timestamptz, add column
booking_id uuid references bookings(id);`

### B10. Two parallel service-request models
`service_requests` (`0083`, store-scoped, 2 rows, full state machine) and `craft_requests`
(`0239`, provider-scoped for the standalone `/crafts` directory, 0 rows, `status text`).
Both exist; neither is wrong; together they are duplication.
**Do not merge them destructively.** `craft_requests` has 0 rows, so if the `/crafts` vertical
is being retired, the safe move is to stop writing to it and leave the table.

### B11. Real estate / vehicle offerings
`products` + `attributes jsonb` (6 of 65 rows populated). Covered in detail in doc 06 §4.
**Additive fix:** typed nullable columns for the five `filter: true` fields plus the
sale-vs-rent distinction. See doc 06 §6.1.

---

## 3. Bucket C — GENUINELY MISSING

No table, no column, no function.

| Missing entity | Why it matters | Additive shape |
|---|---|---|
| **Return / RMA** | `payment_kind='refund'` records money out; nothing records goods back, reason, or restock | `order_returns(order_id, order_item_id, quantity, reason, status, created_at)` |
| **Membership expiry job** | `store_memberships.ends_on` is computed once and never read. Nothing expires a membership; a gym cannot answer "who is a member today" | a `pg_cron`-style function alongside the existing `expire_stale_listings` and `scan_booking_reminders` |
| **Ticket check-in / code** | `event_tickets` has no scannable reference and no check-in timestamp | `alter table event_tickets add column code text unique, add column checked_in_at timestamptz;` |
| **`sold` decrement path** | `event_ticket_types.sold` only ever increments. Any cancel/refund silently drifts the counter and permanently under-sells the event | a `cancel_ticket()` RPC that decrements inside the same transaction |
| **Quote → money** | An accepted `service_requests.quote_amount` never becomes an order, invoice or payment | nullable `service_requests.order_id uuid references orders(id)` + a conversion RPC |
| **Deposit / no-show fee** | `bookings` has `no_show` in its enum and `accommodation_units` has `security_deposit`; neither is ever charged, held or refunded | `booking_deposits` / reuse `order_payments` with a nullable `booking_id` |
| **Stay audit trail** | `orders` has two event tables; `bookings` has notification triggers; `stay_bookings` has neither | `stay_events(stay_id, from_status, to_status, actor_id, created_at)` |
| **Guest-stay / guest-ticket lookup** | see B4 | two `SECURITY DEFINER` functions, no schema change |
| **Offering-type registry** | which surface a sector shows lives in five `Set` literals in `src/lib/store-experience.ts:35,41,46,54` plus `sectorConfig[].features` in `src/lib/sectors.ts:182`; the two drift (doc 07 §10.4) | a `sector_surfaces` table, or consolidate to one TS file — a code decision, not necessarily a migration |

---

## 4. Destructive changes — flagged, do not run

Anything on this list would lose or invalidate live merchant data. None of it is recommended.

| Change | Why it is destructive |
|---|---|
| Collapsing `accommodation_units`, `event_ticket_types`, `store_classes`, `store_courses`, `store_membership_plans`, `store_resources` into one `offerings` table | Would drop typed, CHECK-constrained columns (`min_nights`, `max_guests`, `capacity`, `period`, `day_of_week`) into a JSON blob — the exact anti-pattern the brief warns about. 4 live units, 1 class, 2 courses, 2 resources would need migrating with no rollback. |
| `ALTER TYPE` on `course_enrollments.status` / `store_memberships.status` / `event_tickets.status` to enums | A type rewrite on live tables with a default and (for memberships) an RLS-protected update path. Add CHECK constraints instead (B5). |
| Dropping `products.attributes` after promoting fields to columns | 6 live rows hold data there, and the long-tail fields (`furnished`, `gearbox`, `fuel`, `condition`) have no proposed column. Keep the blob for the tail. |
| Dropping the v1 `bookings.requested_date` / `requested_time` columns after the `starts_at` backfill | All 22 live rows depend on them, and `cancel_my_booking` reads them as its fallback. Keep both generations until `starts_at` is non-null everywhere and the fallback is removed. |
| Merging `craft_requests` into `service_requests` | Different tenancy (`provider_id` vs `store_id`), different RLS helper (`owns_craft_provider`), different lifecycle. 0 rows means abandonment is safe; merging is not. |
| Removing `DIRECTORY_ONLY_SECTORS` entries for `realEstate` / `automotive` | Not a migration, but it is the switch that exposes a cart on a car. Only flip it once B11 lands, because `price` currently means both "sale price" and "monthly rent". |
| Regenerating `src/i18n/dictionaries/*.json` programmatically as part of any of this | Documented repo trap: never rewrite those files via `JSON.stringify`. |

**Migration-file drift, unresolved.** `supabase/migrations/` contains **267 `.sql` files**
(highest `0271_tell_the_merchant_what_happened_to_their_store.sql`), while production reports
**259 applied migrations**. The applied versions are timestamps (`20260815121159`), not the
repo's `NNNN_` prefixes, so **I could not name-match them to determine which repo files are
unapplied.** This is worth resolving before any new migration is written, but it is outside
what this audit can verify.

---

## 5. The "giant unstructured JSON blobs" concern, assessed against real usage

There are **37 `jsonb`/`json` columns across 119 tables**. That is roughly one per three
tables — low for an application of this size, and most are legitimate.

### 5.1 Legitimate — lists of scalars or opaque payloads. Leave alone.
`products.gallery`, `accommodation_units.images`, `accommodation_units.amenities`,
`listings.images`, `gigs.gallery`, `wholesale_products.gallery`, `craft_requests.photos`,
`product_reviews.photos`, `profiles.languages`, `profiles.skills`,
`business_leaders.achievements/_en/companies/socials/source_urls/tags/tags_en`,
`notifications.data`, `audit_logs.metadata`, `automation_runs.detail`,
`academy_guides.blocks`. None of these is queried by key, filtered on, or summed.

### 5.2 Defensible — configuration, not transaction data.
`stores.hours` (**15 of 33 stores populated** — genuinely used), `store_modules.config` (7
rows), `store_staff.permissions` (1 row), `store_checkout_fields.options` (0 rows),
`automations.actions` / `.conditions` (8 rows), `delivery_companies.api_config` /
`.pricing_rules` (0 rows). These are per-tenant settings with no cross-tenant reporting
requirement. Acceptable.

### 3 columns that deserve attention:

### 5.3 `products.attributes` — **the real problem, and it is small today**
`jsonb NOT NULL DEFAULT '{}'`, **6 of 65 rows populated**. Five of the fields it holds are
flagged `filter: true` in `src/lib/attributes.ts` — i.e. intended as buyer-facing search
filters — inside an untyped, unindexed, unvalidated object. It also duplicates
`products.duration_minutes` via an `attributes.duration` field
(`src/lib/attributes.ts:24-29`). **Fix now while it holds 6 rows.** Full analysis in doc 06 §4.

### 5.4 `store_invoices.lines` — **line items in a blob, 0 rows today**
An invoice's lines are the invoice. Holding them as `jsonb` means no per-line reporting, no
FK to `products`, no referential integrity with `order_items`. It has **0 live rows**, so
splitting it into `store_invoice_lines` right now is free. Ignore it and it becomes the most
expensive blob in the schema. (`issue_invoice` and `issue_credit_note` RPCs exist and would
need updating.)

### 5.5 `wholesale_products.tiers` — price breaks in a blob, 0 rows
Same argument, lower stakes. `tiers` encodes quantity→price breaks; those are queried
(what price at qty N?) and should be rows. 0 live rows means the fix is free today.

### 5.6 Borderline, currently harmless
`orders.custom_fields` (`0180`) — **0 of 7 live orders populate it.** It is per-store arbitrary
checkout data with a companion `store_checkout_fields` definition table (also 0 rows), so the
shape is at least declared elsewhere. Built but unused; revisit if it starts filling.
`checkout_intents.items` — an abandoned-cart snapshot; a denormalised snapshot is the right
call here.

### 5.7 Verdict on the concern
**Justified in principle, but the brief overstates the current damage.** There is no giant
unstructured blob carrying live transaction data anywhere in this schema. There are three
columns (`products.attributes`, `store_invoices.lines`, `wholesale_products.tiers`) that will
become one if left alone, and all three currently hold **6, 0 and 0 rows respectively** — which
makes this the cheapest moment in the project's life to fix them. That is the finding: not
"the model is full of blobs", but "three blobs are still empty enough to fix for free".

---

## 6. Recommended additive migration sequence

Ordered by value per unit of risk. All additive; none drops or rewrites a column.

1. **Guest read-back RPCs** for `stay_bookings` and `event_tickets` — no schema change, closes
   a permanent data-visibility hole for guests.
2. **CHECK constraints** on the three `text` status columns (B5).
3. **`event_ticket_types.event_at` / `event_ends_at` / `venue`** (B1) — unblocks ticketing;
   0 rows so zero migration risk.
4. **Exclusion constraints + write RPCs for `resource_id` / `class_id` bookings** (B3) — closes
   a live double-booking race. Verify in `begin; ... rollback;` first: if it fails, an overlap
   already exists in the 6 live resource bookings.
5. **`bookings.starts_at` backfill + write path** (B2) — activates two dormant guards.
6. **`store_courses.capacity` / `starts_on` / `ends_on`** (B6).
7. **`leads.scheduled_at` + `leads.booking_id`** (B9).
8. **Membership expiry function** (bucket C) — mirror `expire_stale_listings`.
9. **`event_tickets.code` + `checked_in_at`**, plus a `cancel_ticket()` that decrements `sold`
   (bucket C).
10. **`store_invoice_lines`** and **`wholesale_product_tiers`** — free while both are at 0 rows
    (§5.4, §5.5).
11. **Typed listing columns on `products`** (B11 / doc 06 §6.1) — must land before
    `realEstate`/`automotive` leave directory-only mode.
