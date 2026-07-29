# 19 — Test Coverage Gaps

_Checkpoint 0._

## Current
- **8 test files, 43 tests** (`vitest`), all passing. Coverage is concentrated in pure logic: `store-experience.test.ts` (resolver, 11 tests) + a handful of lib helpers.
- **No tests for:** RPCs (the actual business logic), RLS policies, concurrency/races, components, checkout/booking flows, API routes.
- Verification for shipped waves has been **manual** (tsc + build + curl SSR + ad-hoc SQL DO-block adversarial checks) — effective but not regression-captured.

## Gaps (by risk)
| ID | Area | Gap | Priority |
|---|---|---|---|
| TEST-01 | Concurrency | No automated test proves stock/booking/ticket/stay guards hold, or that memberships/coupon (CID-01/04) fail — the contention suite in `13` is the missing safety net | **High** |
| TEST-02 | RPC unit/integration | `place_customer_order`/`place_guest_order`/`place_booking`/`buy_tickets`/… have no pgTAP or integration tests; price/stock/validation logic is untested in CI | **High** |
| TEST-03 | RLS | No test asserts cross-tenant isolation (merchant A ≠ merchant B; customer A ≠ customer B) — the SQL `set_config` JWT-simulation trick used manually should be codified | High |
| TEST-04 | Checkout/booking E2E | No end-to-end test of the cart→order or booking flow | Medium |
| TEST-05 | Components | 233 components, ~0 component tests | Medium |
| TEST-06 | Regression for known fixes | Fixes like FE-04 idempotency, CID-01 uniqueness, SEC-01 verification read have no test locking them in | Medium |

## Recommendation (Checkpoint 1 — additive, non-destructive)
1. **pgTAP or a `vitest` + local-supabase harness** for the write RPCs: assert server-side pricing, stock rejection, ownership, and the concurrency guards (run the contention scenarios against a local DB).
2. **RLS isolation tests** codifying the `set_config('request.jwt.claims', …)` JWT-simulation pattern already used manually.
3. **Regression tests** for each Critical/High finding as it is fixed (fix + test land together).
Target: get the **data-integrity guarantees** (`14` acceptance criteria) under automated test before any marketing scale.
