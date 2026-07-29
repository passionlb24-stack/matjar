# 13 — Load & Stress Test Plan

_Checkpoint 0 deliverable. **Not to be executed until Checkpoint 2 with explicit approval and a confirmed disposable staging environment.**_

## Blocker
- **No staging environment exists** (single Supabase project + single Vercel target; `.env.local` + `.env.example` only). Load tests MUST NOT run against production (would send fake orders/bookings/notifications, mutate the live DB, and risk real WhatsApp deep-link traffic).
- **Required before any test:** (1) a disposable Supabase project (branch or clone) seeded with generated data; (2) a Vercel preview deployment pointed at it; (3) confirmation that push/notification/WhatsApp integrations are stubbed.

## Recommended tool
**k6** (not currently installed). Scriptable, good percentile output, CI-friendly. Alternatives: Artillery, Locust. **Do not install until approved.**

## Test data generation plan (Checkpoint 2, approved only)
Seed the disposable DB with: 10,000 stores · 1,000,000 products · 5,000,000 order_items · 1,000,000 bookings · 10,000,000 store_visits/analytics events. Use a SQL `generate_series` seeder in the staging DB only. **Never run against production.**

## Test suites

### Read-heavy (baseline + ramp)
Targets: `/` home, `/explore`, `/search?q=…`, `/[store-slug]`, `/product/[id]`, `/hub/academy`, `/hub/leaders`. Ramp 1→200 RPS over 5 min, hold 10 min.

### Write-heavy
- Guest order (`place_guest_order`) — the hot commerce write.
- Authenticated order (`place_customer_order`).
- Booking (`place_booking`), stay (`place_stay_booking`), ticket (`buy_tickets`), lead (`create_lead`).
- Merchant: product create, order status update.
- **All against staging with stubbed notifications.**

### Contention (the data-integrity tests — highest value)
| Test | Clients | Pass criterion |
|---|---|---|
| Final stock unit — N buyers, 1 unit | 20–100 | exactly 1 success, rest `insufficient_stock`; **0 oversell** |
| Same slot — N booking attempts | 20–100 | exactly 1 (or capacity) success; **0 double-book** |
| Limited coupon — N redemptions, max_uses=1 | 20–100 | exactly 1 discount applied (**currently expected to FAIL — CID-04**) |
| Final seat — N enrollments/memberships | 20–100 | exactly 1 active (**currently expected to FAIL — CID-01**) |
| Ticket capacity — N buyers, capacity=1 | 20–100 | exactly 1; rest `sold_out` (expected PASS — atomic guard) |
| Stay dates — N requests, same unit/dates | 20–100 | exactly 1; rest `dates_taken` (expected PASS — exclusion) |

> The contention suite is the **most important** — it will empirically confirm CID-01 and CID-04 (expected failures) and validate the order/ticket/stay guards (expected passes) **before** those fixes ship, then re-run to prove the fix.

### Soak
Moderate load (Scenario B, ~150 concurrent) for 2–4 h → watch memory, connection count, log growth, latency drift.

### Spike
0→2,000 concurrent in 60s → cold starts, connection bursts, cache effectiveness, error behavior.

## Metrics to capture — see `19_LOAD_TEST_METRICS` targets in `14`.
