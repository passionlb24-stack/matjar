# 05 — Backend & API Audit

_Checkpoint 0. Matjar's "backend" is almost entirely Postgres `SECURITY DEFINER` RPCs (194 migrations) + 4 Next API routes + 1 server action. Full per-RPC security/concurrency detail is in `09_CONCURRENCY_DATA_INTEGRITY.md`; this file summarizes the API surface and the write-operation checklist._

## Surface
- **Write RPCs (client-callable):** `place_customer_order`, `place_guest_order`, `place_booking`, `place_stay_booking`, `buy_tickets`, `subscribe_membership`, `enroll_course`, `create_lead`, `update_lead_status`, `reschedule_booking`, `cancel_my_order`, `cancel_my_booking`, `record_order_payment`, `redeem_loyalty_points`, `transfer_store_ownership`, `add_store_staff`, `pos_record_sale`, `record_referral`, `track_store_visit`, … (~60 DEFINER functions).
- **API routes (4):** `src/app/api/push/*` (broadcast/hook) — **needs runtime verification** of secret validation + replay protection.
- **Server actions (1):** `use server` found in 1 file — the app deliberately routes writes through RPCs.

## Write-operation checklist (aggregate)
Applying the 10-point checklist across the write RPCs (detail per-RPC in `09`):

| Check | Status |
|---|---|
| 1. Who can call it? | Documented per RPC; guest flows are `grant to anon` by design, manager flows re-check `can_manage_store` |
| 2. Identity established? | `auth.uid()` for authed; phone-proof for guest lookups |
| 3. Ownership checked server-side? | ✅ for manager writes; ⚠️ AUTH-03 uses coarse `can_manage_store` on new engines |
| 4. Input validated? | ✅ mostly; ⚠️ CID-10 `add_store_staff.p_role` / `update_lead_status.assigned_to` unvalidated |
| 5. Atomic? | ✅ (RPC = transaction); ⚠️ CID-07 `pos_record_sale` stock non-atomic |
| 6. Double-submittable? | ✅ orders (idempotency) & booking (exclusion); ⚠️ CID-03/05/09 tickets/payment/capacity-booking, FE-04 product-page order |
| 7. Concurrent corruption? | ✅ orders/provider/stay/ticket-capacity; ❌ CID-01 memberships/enroll, CID-04 coupons |
| 8. Audit event recorded? | Partial — `audit_logs` + `order_events` exist; not uniform across all writes |
| 9. Partial data on failure? | Low risk (single-txn RPCs) |
| 10. Rollback/compensation? | Order cancel/reject restores stock symmetrically; no compensation for external push failures (fire-and-forget, correct) |

## API-route findings
| ID | Title | Severity | Note |
|---|---|---|---|
| API-01 | `api/push/*` route secret validation, replay protection, and payload-size limits not verified this checkpoint | Medium | **Needs runtime verification** — read `src/app/api/push/*/route.ts` and confirm the shared-secret check + rejection of oversized/duplicate events |
| API-02 | No global rate-limiting layer in front of API routes / RPCs beyond per-RPC row-count checks (guest order 5/hr/phone, create_lead 5/hr) | Medium | Public forms (stay, tickets) lack the same rate-limit — see CID-02/03. No WAF/edge rate-limit identified (Vercel + Supabase defaults only) |
| API-03 | Error surface: RPCs `raise exception '<code>'` with short codes; the client maps known codes and falls back to a generic message — good (no raw DB errors leaked to users) | Low/OK | Verified in `store-products.tsx`, `product-order.tsx` |

## Strengths
- **Server-side price/stock/availability recompute** is centralized in the DB and cannot be bypassed by a modified client — the single most important property for a commerce platform, and it holds.
- Guest lookups (`get_guest_order`, `get_guest_order_events`) require phone-number proof.
- `transfer_store_ownership` is well hardened (null-safe guard, txn-local role escape hatch, EXECUTE revoked from anon).

## Cross-references
- Concurrency/race findings CID-01…CID-10 → `09_CONCURRENCY_DATA_INTEGRITY.md`
- Authorization findings AUTH-01…AUTH-05 → `07_RLS_AUTHORIZATION_AUDIT.md`
