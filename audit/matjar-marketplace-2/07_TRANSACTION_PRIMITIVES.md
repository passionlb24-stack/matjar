# 07 — Transaction Primitives

**Scope:** one section per primitive — table(s), RPC(s), status vocabulary, confirmation model,
cancellation model, RLS posture, real gaps.

**Method:** live `pg_catalog` / `information_schema` / `pg_policies` / `pg_constraint` reads
against production (`wesihatopiznatsyfxer`) and function bodies via `pg_get_functiondef`, plus
the repo at `C:\Users\m-cha\Documents\gh\matjar`. Migration numbers cite files in
`supabase/migrations/`.

---

## 0. Summary table

| # | Primitive | Table(s) | Write RPC | Status enum? | Merchant action UI | Customer cancel | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Commerce order | `orders` + 4 satellites | `place_customer_order`, `place_guest_order` | ✅ `order_status` | ✅ | ✅ `cancel_my_order` | **Complete** |
| 2 | Appointment | `bookings` | `place_booking` | ✅ `booking_status` | ✅ | ✅ `cancel_my_booking` | **Complete, running on v1 columns** |
| 3 | Reservation (resource/class) | `bookings` + `store_resources`/`store_classes` | direct insert (RLS) | ✅ (shared) | ✅ | ✅ | **Incomplete — no overlap guard** |
| 4 | Lead / inquiry | `leads`, `lead_activities` | `create_lead`, `update_lead_status` | ✅ `lead_status` | ✅ | ❌ | **Complete except customer visibility** |
| 5 | Service request / quote | `service_requests` | `manage_service_request` | ✅ `service_request_status` | ✅ | ✅ | **Complete — best state machine in the schema** |
| 6 | Stay / rental | `stay_bookings`, `accommodation_units` | `place_stay_booking`, `search_stay`, `update_stay_status` | ✅ `stay_status` | ✅ | ❌ | **Real engine; guest + cancellation gaps** |
| 7 | Enrollment | `course_enrollments`, `store_courses` | `enroll_course` | ❌ free text | ❌ read-only | ❌ | **Incomplete** |
| 8 | Membership | `store_memberships`, `store_membership_plans` | `subscribe_membership` | ❌ free text | ❌ read-only | ❌ | **Incomplete** |
| 9 | Ticketing | `event_tickets`, `event_ticket_types` | `buy_tickets` | ❌ free text | ❌ read-only | ❌ | **Incomplete** |

Pattern worth naming up front: **the four primitives with a Postgres ENUM status
(`order_status`, `booking_status`, `lead_status`, `service_request_status`, `stay_status`) all
have merchant transition UI and a defined lifecycle. The three with a `text` status default
(`'enrolled'`, `'active'`, `'reserved'`) have none.** The enum is the tell.

---

## 1. Commerce order

**Tables.** `orders` (7 rows) → `order_items`, `order_payments` (`0082_order_payments_ledger.sql`),
`order_events`, `order_status_events` (`0173_order_status_events.sql`),
`delivery_requests` (`0213_delivery_requests.sql`).

`orders` carries 32 columns including `fulfillment fulfillment_type` (`delivery|pickup`),
`subtotal`/`delivery_fee`/`discount`/`total`, `currency` + `fx_rate`, `tax_rate` + `tax_amount`,
`coupon_code`, `idempotency_key`, `scheduled_for`, `custom_fields jsonb`
(`0180_custom_checkout_fields.sql`), `delivery_zone_id`, `change_for`, `tags text[]`.

**RPCs.** `place_customer_order` (14 args) and `place_guest_order` (14 args) —
both `SECURITY DEFINER`. Called from `src/components/store-products.tsx` and
`src/components/product-order.tsx`. Supporting: `validate_coupon`, `record_order_payment`,
`record_checkout_intent` (`0120_abandoned_cart.sql`), `request_delivery`, `cancel_my_order`,
`get_guest_order` / `get_guest_order_events`.

**Status vocabulary.** `order_status` = `pending, accepted, preparing, ready,
out_for_delivery, completed, cancelled, rejected`. Payment side: `payment_kind` =
`payment, refund`.

**Confirmation model.** Customer submits → `pending`. Merchant accepts. Transitions are
guarded server-side by a trigger `guard_order_status_transition` (SECURITY INVOKER), money
columns by `guard_order_money_columns`. Every change is logged twice — `log_order_status` →
`order_events`, `log_order_status_change` → `order_status_events` (26 `order_events` rows
live). `notify_new_order` / `notify_order_status` push notifications.

**Cancellation model.** `cancel_my_order(p_id)` — customer-side, and **only while `status =
'pending'`**; otherwise raises `cannot_cancel` with SQLSTATE `42501`. Merchant can move to
`cancelled`/`rejected` through the guarded transition. `restore_stock_on_cancel` and
`refund_loyalty_on_cancel` triggers unwind side effects; `sync_coupon_use_on_status` unwinds
coupon counters.

**RLS.** `orders_insert_customer` — `authenticated`, `WITH CHECK (auth.uid() = customer_id
AND user_is_active())`. `orders_select` — super-admin OR own OR `staff_can(store_id,'orders')`
OR store owner. `orders_update` — staff/owner only, so a customer can never mutate their own
order except through the RPC. `order_items` inherits via an `EXISTS` on `orders`. Guest orders
bypass RLS entirely through the `SECURITY DEFINER` RPC, with `guard_guest_order_rate` as the
abuse control and `get_guest_order(p_order_id, p_phone)` as the read-back path.

**Gaps.**
- **No returns / RMA primitive.** `payment_kind='refund'` records the money, nothing records
  the goods coming back or why.
- **No fulfilment record beyond delivery.** `delivery_requests` covers third-party couriers;
  self-delivery and pickup have no shipment/handover row.
- `custom_fields jsonb` is used by **0 of 7 live orders** — built but unused.
- No partial-cancellation: an order is all-or-nothing, there is no per-`order_item` void.

---

## 2. Appointment

**Table.** `bookings` (22 rows), created early and extended by `0174_booking_engine.sql`
("booking engine v2"), `0188_no_past_bookings.sql`, `0189_booking_cancel_window.sql`.

Two generations of columns coexist:
- **v1:** `requested_date date`, `requested_time text` — *this is what all 22 live rows use*.
- **v2:** `starts_at`, `ends_at timestamptz`, `allocation_mode text` — **`starts_at IS NULL`
  on all 22 live rows.**

**RPCs.** `place_booking(store, product, date, time, doctor, any, name, phone, notes, coupon)`
→ `jsonb {ok, code}`. Availability reads: `booked_times`, `get_booking_busy`,
`resource_booked_times`, `class_spots_taken`. Lifecycle: `reschedule_booking`,
`cancel_my_booking`, `confirm_booking_attendance`, `join_booking_waitlist`
(`0178_booking_waitlist.sql`), `scan_booking_reminders`.

**Status vocabulary.** `booking_status` = `pending, accepted, scheduled, completed,
cancelled, rejected, no_show`.

**Confirmation model.** `place_booking` **requires login** — it returns
`{ok:false, code:'auth'}` when `auth.uid()` is null. It then resolves duration from
`products.duration_minutes` → `stores.booking_slot_minutes` → 30; for `pooled_providers` it
picks a free `doctor` by checking overlapping bookings, `provider_availability_rules` and
`provider_availability_exceptions`; for `capacity_based` it takes a
`pg_advisory_xact_lock` and counts overlapping rows against `products.capacity_per_slot`.
Row lands `pending`; merchant accepts.

**Concurrency guards (real, and good).** Two GiST exclusion constraints:
- `bookings_provider_no_overlap` — `EXCLUDE (doctor_id WITH =, tstzrange(starts_at, ends_at)
  WITH &&) WHERE doctor_id IS NOT NULL AND starts_at IS NOT NULL AND allocation_mode IN
  ('provider_exclusive','pooled_providers') AND status IN ('pending','accepted','scheduled')`
- `bookings_solo_exclusive_no_overlap` — same idea for a single-operator store
  (`doctor_id IS NULL`).

**Cancellation model.** `cancel_my_booking(p_id)` — customer-side, allowed from
`pending|accepted|scheduled`, and enforces the store's notice window
`stores.booking_cancel_hours` (`0189`), computing the appointment instant from `starts_at` or
falling back to `requested_date + requested_time` at `Asia/Beirut`. Too late →
`cancel_too_late`, SQLSTATE `53400`. `reject_past_booking` trigger blocks booking into the past
(`0188`).

**RLS.** `bookings_insert_customer` — `authenticated`, `auth.uid() = customer_id AND
user_is_active()`. `bookings_select` — own OR `staff_can(store_id,'bookings')` OR owner OR
super-admin. `bookings_update` — **staff/owner only**; the customer's own cancel and reschedule
must go through the `SECURITY DEFINER` RPCs. Correct posture.

**Gaps.**
- **The v2 columns are dead in production.** Both exclusion constraints are predicated on
  `starts_at IS NOT NULL`, and `starts_at` is NULL on 100% of live rows — so **the
  double-booking guards are not actually protecting any live booking today.** The protection
  is real code sitting behind a column nobody writes. This is the single highest-value fix in
  this document.
- No guest (unauthenticated) appointment path, unlike orders which have `place_guest_order`.
  A phone-first Lebanese customer must create an account to book.
- `bookings.service_name text` duplicates `products.name` with no backfill guarantee.
- No deposit / no-show fee, despite `no_show` being in the enum.

---

## 3. Reservation (resource timeslot, class, restaurant table)

**Tables.** `store_resources` (`0128_store_resources_timeslot.sql`, 2 rows),
`store_classes` (`0130_store_classes.sql`, 1 row), both booked into `bookings` via
`bookings.resource_id` (6 live rows) and `bookings.class_id` (1 live row).

**RPCs.** Read-side only: `resource_booked_times(p_resource_id, p_date)`,
`class_spots_taken(p_class_id, p_date)`. **There is no `place_resource_booking` or
`place_class_booking`.** The clients — `src/components/timeslot-booking.tsx`,
`src/components/classes-booking.tsx`, and `src/components/reservation-form.tsx:59` (restaurant
tables) — **insert directly into `bookings` through the `bookings_insert_customer` RLS
policy**.

**Status vocabulary.** Shares `booking_status`.

**Confirmation model.** Direct insert → `pending`; merchant accepts on the bookings screen.

**Cancellation model.** Inherits `cancel_my_booking` and `reschedule_booking`.

**RLS.** `store_resources` / `store_classes` are world-readable
(`USING (true)`) and managed by `can_manage_store` / `staff_can(store_id,'classes')`.

**Gaps — this is the weakest of the "working" primitives.**
- **No overlap protection.** Both exclusion constraints key on `doctor_id` or `store_id` with
  `allocation_mode` in the provider modes. A `resource_id` booking matches neither predicate,
  so **two customers can book the same padel court for the same hour**. The read-side
  `resource_booked_times` is advisory only and is evaluated in the client, not in a
  transaction.
- **No capacity enforcement for classes.** `class_spots_taken` is a client-side check;
  `store_classes.capacity` is never enforced at write time. Same TOCTOU race.
- **Restaurant reservations have no seating model.** `reservation-form.tsx` writes a booking
  with `party_size` and no resource; a restaurant cannot express "12 tables of 4".
- `store_resources` availability is `open_hour int` / `close_hour int` only — no per-weekday
  hours, no closures, no per-slot pricing.

---

## 4. Lead / inquiry

**Tables.** `leads` (3 rows) and `lead_activities`, both `0190_lead_engine.sql`.

`leads` carries `kind lead_kind`, `name`, `phone`, `message`, `status lead_status`,
`assigned_to`, `last_contacted_at`, optional `product_id`.

**RPCs.** `create_lead(store, product, kind, name, phone, message)` → uuid;
`update_lead_status(lead, status, assigned_to, note)`.

**Status vocabulary.** `lead_kind` = `contact, viewing, test_drive, offer, rental_inquiry`.
`lead_status` = `new, contacted, scheduled, negotiating, won, lost`. Which kinds a sector
offers is set in `src/lib/store-experience.ts:59-64` — realEstate → `viewing|contact|offer`,
automotive → `test_drive|contact|offer`.

**Confirmation model.** No confirmation — a lead is a captured intent, correctly. `create_lead`
validates that the store is `active`/not deleted, validates `p_product_id` belongs to the store
(`bad_product`), rate-limits to 5 per phone per store per hour, writes a `created` row into
`lead_activities`, and notifies the owner (`lead_new`).

**Cancellation model.** None, and none is needed — but see gaps.

**RLS.** `leads_select_store` / `leads_update_store` — `staff_can(store_id,'orders')` **only**.
`lead_activities_select_store` — via `can_manage_store` on the parent lead. There is **no INSERT
policy** on either table: all writes funnel through the `SECURITY DEFINER` RPC. Sound design.

**Gaps.**
- **The customer can never see their own lead.** `leads_select_store` has no
  `customer_id = auth.uid()` branch, even though `create_lead` stores `customer_id`. A buyer
  who requested a viewing has no record of it anywhere in the app.
- **`lead_status = 'scheduled'` has nothing to schedule.** There is no `scheduled_at` column
  and no link to a `bookings` row, so "scheduled" is a label, not an appointment. A real-estate
  viewing cannot be put on a calendar.
- No `won` conversion path — a won lead does not become an order, a stay, or anything else.
- `lead_activities` has an `activity_type text` with no CHECK; only `'created'` is written by
  the platform.

---

## 5. Service request / quote

**Table.** `service_requests` (2 rows), `0083_service_requests.sql`, later extended with
`counter_amount` / `counter_note`.

**RPC.** `manage_service_request(p_id, p_action, p_amount, p_note)` — a single dispatcher
handling `quote`, `decline`, `start`, `complete` (provider side) and `accept`, `counter`,
`cancel` (customer side).

**Status vocabulary.** `service_request_status` = `pending, quoted, accepted, in_progress,
completed, declined, cancelled, countered`.

**Confirmation model — the most complete in the schema.** Every branch re-checks the actor
(`staff_can(store_id,'bookings') OR is_super_admin()` vs `customer_id = auth.uid()`), and every
`UPDATE` carries a **`WHERE ... AND status IN (...)` legal-predecessor guard**, so an illegal
transition silently no-ops instead of corrupting state. Both sides get a notification on every
transition (`service_quote`, `service_declined`, `service_completed`, `service_accepted`,
`service_countered`). Negotiation is genuinely two-way: quote → counter → re-quote → accept.

**Cancellation model.** `p_action='cancel'`, customer only, from
`pending|quoted|countered|accepted`. Provider equivalent is `decline`, allowed additionally
from `in_progress`.

**RLS.** `service_requests_insert` — `WITH CHECK (customer_id = auth.uid() AND user_is_active()
AND length(trim(description)) > 0 AND length(trim(phone)) >= 4)`; content validation in the
policy itself. `service_requests_select` — store OR super-admin OR the customer. No UPDATE
policy: all mutation is RPC-only.

**Gaps.**
- **The accepted quote never becomes money.** `quote_amount` is a number on a request; there is
  no order, no invoice, no `order_payments` row. `completed` and paid are indistinguishable.
- No attachments (`craft_requests` has `photos jsonb`; `service_requests` does not).
- No scheduled date — a request cannot be put in the diary without manually creating a
  separate booking.
- **Duplicate vertical:** `craft_requests` (`0239_craft_requests_and_reviews.sql`, 0 rows)
  is a parallel request inbox for the standalone `/crafts` provider directory
  (`craft_providers`, `craft_services`, `craft_works`, `craft_reviews`), with its own status
  text column and its own RLS (`owns_craft_provider`). Two request models for the same job.

---

## 6. Stay / rental

**Tables.** `accommodation_units` (4 rows) and `stay_bookings` (2 rows), both
`0191_accommodation_engine.sql`. Search-path hardened in
`0195_harden_stay_base_total_searchpath.sql`.

**This engine exists and works. Any plan predicated on "the stay engine does not exist yet" is
out of date.** Confirming evidence: the routes `merchant/[storeId]/stays/page.tsx` and
`merchant/[storeId]/units/page.tsx` exist; the storefront mounts `<StaySearch>` at
`src/app/[lang]/(site)/store/[id]/page.tsx:620`; `src/lib/store-experience.ts:41` routes
`hospitality` to `STAY_SECTORS`; `sectorPrimarySetup()` in `src/lib/sectors.ts:428-430` tells a
hospitality merchant to create `accommodation_units` first.

**RPCs.**
- `search_stay(store, check_in, check_out, guests)` → table of available units with computed
  totals. Filters on `max_guests`, `min_nights`, and a **`daterange && daterange` NOT EXISTS**
  against live bookings; orders by `grand_total`.
- `place_stay_booking(unit, check_in, check_out, adults, children, name, phone, notes)` → uuid.
- `stay_base_total(unit, check_in, check_out)` — pricing helper honouring `weekend_price`.
- `update_stay_status(p_id, p_status)` — merchant transition.

**Status vocabulary.** `stay_status` = `requested, confirmed, declined, checked_in,
checked_out, completed, cancelled, no_show`.

**Confirmation model.** Guest submits → `requested`; merchant confirms via
`<StayStatusControl>` on the stays page. `place_stay_booking` validates: non-empty name/phone,
`check_out > check_in` and `check_in >= current_date` (`invalid_range`), rate limit of 5 per
phone per hour, unit `active`, `nights >= min_nights` (`min_stay`),
`adults + children <= max_guests` (`over_capacity`). It snapshots money onto the booking row
(`base_total`, `cleaning_fee`, `deposit_amount`, `grand_total`) rather than recomputing later —
correct.

**Concurrency guard (real).** `stay_no_overlap`:
`EXCLUDE USING gist (unit_id WITH =, daterange(check_in, check_out, '[)') WITH &&)
WHERE status IN ('requested','confirmed','checked_in')`. `place_stay_booking` catches
`exclusion_violation` and raises `dates_taken`. **Unlike the appointment engine, this guard is
live** — it keys on columns every row actually populates. Plus `stay_valid_range`
CHECK `(check_out > check_in)`.

**Cancellation model.** **Merchant-only.** `update_stay_status` checks
`can_manage_store(v_store)` and then does an unguarded
`update ... set status = p_status` — **any status to any status, no legal-predecessor
predicate**, unlike `manage_service_request`. There is no `cancel_my_stay`.

**RLS.** `accommodation_units`: `units_public_read USING (active = true OR
can_manage_store(store_id))`; `units_manage ALL USING staff_can(store_id,'products')`.
`stay_bookings`: `stays_select USING (staff_can(store_id,'bookings') OR customer_id =
auth.uid())`; `stays_update_store` staff-only; **no INSERT policy** — RPC-only writes.

**Gaps.**
- **Guest stays are write-only.** `place_stay_booking` sets `customer_id := auth.uid()`, which
  is NULL for a guest. `stays_select` then matches neither branch, and there is **no
  `get_guest_stay(id, phone)` equivalent to `get_guest_order`**. A guest who books a chalet can
  never see or manage that booking again.
- **No customer cancellation at all**, and `accommodation_units.cancellation_policy` is free
  text that nothing reads or enforces.
- **`update_stay_status` has no state machine** — a `completed` stay can be moved back to
  `requested`.
- **No rate calendar.** Pricing is `base_nightly_price` + `weekend_price` only. No seasonal
  rates, no per-date override, no blackout/maintenance dates table — so a hotel cannot close a
  unit for a week except by deactivating it (which also hides it).
- **No deposit collection.** `security_deposit` is snapshotted onto the booking and never
  charged, refunded or tracked.
- No `stay_events` audit trail (orders and bookings both have one).

---

## 7. Enrollment

**Tables.** `store_courses` (`0134_store_courses.sql`, 2 rows) and `course_enrollments`
(`0192_membership_enrollment.sql`, 2 rows).

**RPC.** `enroll_course(p_course_id, p_name, p_phone)` → uuid. **Requires login**
(`login_required`). Idempotent by design: pre-checks for an existing `status='enrolled'` row and
also catches `unique_violation` → `already_enrolled`. Notifies the owner (`enroll_new`).

**Status vocabulary.** **None.** `course_enrollments.status text NOT NULL DEFAULT 'enrolled'`.
No enum, no CHECK constraint (verified — no `c`-type constraint exists on the table).

**Confirmation model.** **None.** Enrollment is immediate and unconditional; the merchant is
notified but cannot approve, waitlist or reject.

**Cancellation model.** **None.** There is no `unenroll_course` RPC. `enrollments_update_store`
lets the merchant flip `status` to any string, but no UI does
(`merchant/[storeId]/members/page.tsx` selects `id, customer_name, phone, status,
store_courses(name)` and renders — **read-only, no mutation call**).

**RLS.** `enrollments_select USING (can_manage_store(store_id) OR customer_id = auth.uid())`;
`enrollments_update_store` staff-only; no INSERT policy (RPC-only).

**Gaps.**
- **`store_courses` has no capacity column.** A course cannot sell out; `enroll_course` has no
  seat check. Unlimited enrollment is the only supported model.
- **`store_courses.schedule` and `.duration` are free text.** A course has no start date, no end
  date, no session list — so an enrollment has no calendar footprint and cannot expire.
- No customer-side leave/withdraw.
- No merchant approval, no waitlist (contrast: appointments have `booking_waitlist`).
- No payment link — `store_courses.price` is displayed and never collected.

---

## 8. Membership

**Tables.** `store_membership_plans` (`0129_store_membership_plans.sql`) and
`store_memberships` (`0192_membership_enrollment.sql`, **0 rows**).

**RPC.** `subscribe_membership(p_plan_id, p_name, p_phone)` → uuid. Requires login. Computes
`ends_on` from `plan.period` (`monthly` → +1 month, `quarterly` → +3, `yearly` → +1 year, else
NULL). Blocks duplicates on `(plan_id, customer_id, status='active')` plus a
`unique_violation` catch. Notifies the owner (`membership_new`).

**Status vocabulary.** **None.** `store_memberships.status text NOT NULL DEFAULT 'active'`.
No enum, no CHECK.

**Confirmation model.** **None** — immediate, unconditional.

**Cancellation model.** **None.** No `cancel_membership`, no `renew_membership`.

**RLS.** `smp_public_read USING (true)`; `smp_manage` via `can_manage_store`.
`memberships_select USING (can_manage_store(store_id) OR customer_id = auth.uid())`;
`memberships_update_store` staff-only; no INSERT policy.

**Gaps.**
- **Nothing expires a membership.** `ends_on` is computed once and never read again. There is
  no scheduled job comparable to `expire_stale_listings` or `scan_booking_reminders`, so a
  membership stays `'active'` forever. A gym cannot tell who is actually a member today.
- **No renewal, no billing.** `store_membership_plans.price` and `.period` describe a recurring
  charge that the platform never charges. No `payments` or `order_payments` linkage.
- **Merchant UI is read-only.** `merchant/[storeId]/members/page.tsx` reads
  `id, customer_name, phone, ends_on, status, store_membership_plans(name)` and renders — no
  suspend, no cancel, no extend.
- **Dashboard access is inconsistent with the sector registry.** `sportsCourts` declares
  `"memberships"` in `sectorConfig.features` (`src/lib/sectors.ts:292`) and the storefront
  renders `<StoreMemberships>` whenever plans exist
  (`src/app/[lang]/(site)/store/[id]/page.tsx:641`) — but `sportsCourts.modules.daily` is
  `["bookings","resources","tasks"]` with **no `memberships` module**
  (`src/lib/sectors.ts:296-301`). A courts merchant can sell memberships they have no screen to
  create or manage.
- 0 live rows — **built but unused**, which is consistent with the above.

---

## 9. Ticketing

**Tables.** `event_ticket_types` (**0 rows**) and `event_tickets` (**0 rows**), both
`0193_event_tickets.sql`.

**RPC.** `buy_tickets(p_type_id, p_quantity, p_name, p_phone)` → uuid. Guest-capable
(`customer_id := auth.uid()`, may be NULL). Rate-limits to 10 purchases per phone per hour.
Capacity is enforced **atomically and correctly**: when `capacity IS NOT NULL`, the counter
bump is `UPDATE ... SET sold = sold + v_qty WHERE id = p_type_id AND sold + v_qty <= capacity
RETURNING id`, and a NULL return raises `sold_out`. NULL capacity means unlimited. Notifies
the owner (`ticket_new`).

**Status vocabulary.** **None.** `event_tickets.status text NOT NULL DEFAULT 'reserved'`.
No enum, no CHECK. The only real constraint is
`event_tickets_quantity_check CHECK (quantity >= 1 AND quantity <= 50)`.

**Confirmation model.** **None** — the row is created `'reserved'` and nothing ever moves it.
`'reserved'` implies a subsequent `'paid'` / `'issued'` state that does not exist.

**Cancellation model.** **None, and the denormalised counter makes this dangerous.**
`event_ticket_types.sold` is incremented on purchase and **never decremented**. Any cancel,
refund or no-show implemented later must decrement it, and there is no RPC that does. If a
merchant flips `event_tickets.status` via `tickets_update_store`, `sold` silently drifts and
the event under-sells forever.

**RLS.** `ticket_types_public_read USING (active = true OR can_manage_store(store_id))`;
`ticket_types_manage ALL USING staff_can(store_id,'products')`.
`tickets_select USING (staff_can(store_id,'products') OR customer_id = auth.uid())`;
`tickets_update_store` staff-only; no INSERT policy.

**Gaps.**
- **There is no event.** `event_ticket_types` has no `event_at`, no `venue`, no `doors_open`.
  A customer buying a ticket cannot be told when or where the event is. This is the reason
  ticketing cannot go live as-is, and it is a schema gap, not a UI gap. See doc 06 §6.2.
- **Guest tickets are write-only** — same defect as stays: `customer_id` NULL and no
  `get_guest_ticket(id, phone)`.
- **Merchant UI is read-only.** `merchant/[storeId]/tickets/page.tsx` selects
  `id, attendee_name, phone, quantity, status, created_at, event_ticket_types(name)` and
  renders. No check-in, no cancel, no refund.
- No ticket code / QR / scan — `event_tickets` has no unique reference column at all beyond
  its uuid.
- No refund path, and no linkage to `order_payments`.

---

## 10. Cross-cutting observations

**10.1 The write funnel is consistently good.** Seven of the nine primitives have **no INSERT
RLS policy at all** — `stay_bookings`, `event_tickets`, `course_enrollments`,
`store_memberships`, `leads`, `lead_activities`, `booking_waitlist`. All writes go through
`SECURITY DEFINER` RPCs with `SET search_path TO ''`, argument validation and rate limits.
That is a deliberate, defensible posture and should be preserved.

**10.2 The read side is where guests fall off a cliff.** Orders solved this with
`get_guest_order(p_order_id, p_phone)` / `get_guest_order_events` and a `/track` route.
Stays and tickets — the two primitives that *most* need guest access in a phone-first market —
have no equivalent. Every guest stay and guest ticket is invisible to the person who created
it, permanently.

**10.3 Three primitives have a `text` status with no CHECK constraint.** `course_enrollments`,
`store_memberships`, `event_tickets`. Verified against `pg_constraint`: no `contype='c'` row
exists on any of them for `status`. Anything can be written into those columns.

**10.4 The resolver's comments are stale and actively misleading.**
`src/lib/store-experience.ts:10` says "sectors whose correct engine does not exist yet", and
lines 29-32 enumerate:
> `- hospitality: needs a date-range STAY engine (currently only hourly slots).`
> `- events: needs TICKETING / venue date booking (currently hourly slots).`

Lines 41-48 of the same file then route `hospitality` to `STAY_SECTORS` and `events` to
`TICKET_SECTORS`, citing migrations `0191` and `0193`. The engines shipped; the comment did
not get updated. **Any planning document that inherited its premise from this comment block
is describing the codebase as it was before `0191`.** Only `realEstate` and `automotive`
remain in `DIRECTORY_ONLY_SECTORS` (`:35-38`) — and both of those now have a real lead engine
(`0190`), so "directory-only" for them means "no cart", not "no transaction".

**10.5 Priority of genuinely incomplete work**, highest value first:

1. `bookings.starts_at` backfill + write path — the two exclusion constraints are inert until
   this happens (§2).
2. Overlap/capacity guard for `resource_id` and `class_id` bookings — currently a real
   double-booking race (§3).
3. Guest read-back for stays and tickets (§6, §9).
4. `event_ticket_types.event_at` / `venue` — ticketing cannot ship without it (§9).
5. Status enums + CHECK constraints + merchant transition UI for enrollments, memberships,
   tickets (§7, §8, §9).
6. Membership expiry job (§8).
7. `sportsCourts` memberships module drift (§8).
