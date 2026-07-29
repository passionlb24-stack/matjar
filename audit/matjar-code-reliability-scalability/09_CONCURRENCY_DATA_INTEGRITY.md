# 09 — Concurrency & Data Integrity

_Checkpoint 0. Evidence = latest `create or replace` RPC definitions in `supabase/migrations/*.sql`, verified against the live schema (indexes/constraints) read-only._

## Summary

The **online order** and **provider/accommodation booking** paths are correctly protected (atomic conditional `UPDATE`s and `btree_gist` exclusion constraints — the strongest form). The gaps are concentrated in the **newer vertical engines** (memberships, enrollments, stays, tickets) and in **coupon** redemption, where the guard is a read-then-write TOCTOU with no backing unique/exclusion constraint.

## Correct-by-design (verified)

| Flow | Guard | Evidence |
|---|---|---|
| Online order oversell | atomic `update products set stock=stock-qty where id=… and stock>=qty; if not found raise 'insufficient_stock'` per item, in-txn, symmetric restore on cancel | `0073_customer_order_rpc_variant_stock.sql:31` |
| Order duplicate submit | `orders_idempotency_key_idx` unique + pre-check + `unique_violation` catch | `0172…:47`, `place_customer_order` |
| Provider double-book | `exclude using gist (doctor_id with =, tstzrange(starts_at,ends_at) with &&)` | `0174_booking_engine.sql:74` |
| Accommodation double-book | `exclude using gist (unit_id with =, daterange(check_in,check_out,'[)') with &&) where status in (…)` | `0191_accommodation_engine.sql:73` |
| Ticket capacity | atomic `update … set sold=sold+qty where id=… and sold+qty<=capacity … if null raise 'sold_out'` | `0193_event_tickets.sql:77` |
| Loyalty redemption | `pg_advisory_xact_lock('loyalty_redeem:'||uid||store)` before balance read | `0107…:104`, `0194…:175` |
| Store ownership transfer | null-safe `is distinct from` guard + txn-local role escape hatch | `0170_transfer_hardening.sql` |
| Referral / staff add | `on conflict … do nothing` on real unique constraints | `0057…`, `0018…` |

## Findings

| ID | Title | Severity | Confidence | Source |
|---|---|---|---|---|
| CID-01 | Membership double-renew & duplicate enrollment: no unique index, TOCTOU `exists`-then-`insert` | **High** | Confirmed | `0192_membership_enrollment.sql:66,104` |
| CID-02 | Anonymous stay requests block inventory; no rate limit / no auth / no expiry | **High** | Confirmed | `0191_accommodation_engine.sql` (`place_stay_booking`, `grant to anon`) |
| CID-03 | Ticket capacity holdable by anon spam; no rate limit / no idempotency / no reserve expiry | Medium | Confirmed | `0193_event_tickets.sql:55` |
| CID-04 | Coupon over-redemption race: `max_uses` bumped unconditionally by AFTER-INSERT trigger; no per-customer cap | Medium | Confirmed | `0028_coupons.sql:56,70` |
| CID-05 | `record_order_payment` double-submit race (read-sum-then-insert, no lock/idempotency) | Medium | Confirmed | `0086_branches_and_ledger_fixes.sql:78` |
| CID-06 | Capacity-mode booking advisory lock keyed on exact start, not the overlapping range | Low | High | `0174…:356`, `0175…:101` |
| CID-07 | `pos_record_sale` stock decrement non-atomic (`greatest(stock-qty,0)`), silently oversells | Medium | Confirmed | `0085_branch_on_transactions.sql:462` |
| CID-08 | Guest `idempotency_key` unique is global but recovery lookup is store-scoped → returns NULL on cross-store key collision | Low | High | `0172…:47` vs `place_guest_order` recovery |
| CID-09 | Bookings lack duplicate-submit idempotency in `capacity_based` mode | Low | High | `0174_booking_engine.sql` |
| CID-10 | Unvalidated privileged inputs: `add_store_staff.p_role` free-text; `update_lead_status.assigned_to` not verified as store member | Low | Confirmed | `0018…:52`, `0190…:141` |

### CID-01 (High) — Membership/enrollment double-renew
`subscribe_membership` / `enroll_course` gate on `if exists(… status='active') raise` then `insert`, with **no unique index** on `store_memberships(plan_id, customer_id) where status='active'` or `course_enrollments(course_id, customer_id) where status='enrolled'`. Two concurrent (or double-clicked) calls both pass the read and both insert → duplicate active membership / enrollment, corrupting member counts and any future billing.
**Fix (Checkpoint 3):** add the partial unique indexes and let the INSERT be the guard (`on conflict … do nothing`, return existing id).

### CID-02 (High) — Anonymous stay inventory denial
`place_stay_booking` is `grant to anon`, unauthenticated, unrate-limited. The exclusion constraint counts `status='requested'`, so an attacker can POST unpaid stay requests across all future dates/units; each blocks real bookings with `dates_taken`. The double-book guard is correct — the abuse is unbounded unpaid inventory lock-up.
**Fix:** rate-limit guest stay requests (mirror `create_lead`), and/or require auth, and/or auto-expire stale `requested` rows.

### CID-04 (Medium) — Coupon over-redemption
`validate_coupon` is `stable` (read-only); `used_count` is incremented by an AFTER-INSERT trigger **unconditionally** (no `where used_count < max_uses`). Two concurrent checkouts each read `used_count=0` vs `max_uses=1`, both discount, both insert → a single-use coupon redeemed twice. No per-customer cap exists either.
**Fix:** conditional bump `update coupons set used_count=used_count+1 where … and (max_uses is null or used_count<max_uses); if not found raise 'coupon_used_up'`, or a `coupon_redemptions` table with `unique(coupon_id, customer_id)`.

_(CID-03/05/06/07/08/09/10 detailed above in the table; fixes summarized in `21_PRIORITIZED_ACTION_PLAN.md`.)_

## Note for the owner
CID-01/02/03 are in engines shipped in this development cycle (memberships, stays, tickets). They are **race conditions, not everyday bugs** — with current traffic (0 orders, test data) they are latent, but they must be closed **before** any marketing push that drives concurrent traffic to those flows. None can be triggered by a single well-behaved user; all require concurrency or deliberate abuse.
