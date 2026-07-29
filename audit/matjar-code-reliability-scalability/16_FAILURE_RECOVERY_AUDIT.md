# 16 — Failure & Recovery Audit

_Checkpoint 0. Behavior analysis from code; runtime failure injection not performed (would need staging)._

## Failure-mode behavior
| Failure | System behavior | Assessment |
|---|---|---|
| DB temporarily unavailable | Supabase client throws; page/RPC errors → generic error UI (`error.tsx`) | OK (no crash), but **no retry/backoff, no APM alert** (OPS-01) |
| Storage upload fails | client surfaces error; no order dependency | OK |
| Push/notification fails | fire-and-forget, isolated from checkout (verified) | **Correct** — a failed notification never rolls back a valid order |
| WhatsApp deep-link unavailable | client-side `wa.me` link; no server dependency | OK |
| API request times out | user sees error; **duplicate risk on retry** for order via product page (FE-04) — order via cart/booking are idempotent | Mixed — fix FE-04 |
| Browser loses connection mid-checkout | order RPC is one atomic txn — either fully committed or not; idempotency key (cart) dedupes retry | **Good** for cart; product page lacks key (FE-04) |
| User submits twice | cart/order idempotency + booking exclusion dedupe; **memberships/enroll/tickets/coupon do NOT** (CID-01/03/04) | Gaps per `09` |
| Serverless retry | RPCs with idempotency key are safe; others may double-write | Fix idempotency gaps |
| Migration fails halfway | applied directly to prod (no staging rehearsal) | **Reliability risk** — no dry-run environment |
| Deployment rollback | Vercel keeps previous deployment; **DB migrations are forward-only, not auto-rolled-back** | **Risk** — code rollback ≠ schema rollback |
| DB connection limit hit | new requests error 500 | needs pool strategy at scale (`12`) |
| Merchant imports malformed data | product create validates per-field; bulk import path not identified | Needs verification |

## Findings
| ID | Title | Severity |
|---|---|---|
| REC-01 | No staging → migrations applied directly to production, un-rehearsed; code rollback doesn't roll back schema | **High (operational)** |
| REC-02 | Duplicate-write on retry for product-page order (FE-04) and membership/enroll/ticket/coupon (CID-01/03/04) | High (see `09`) |
| REC-03 | No retry/backoff on transient DB errors; no reconciliation job for partial/failed flows | Medium |
| REC-04 | No documented backup/restore test, RPO/RTO | Medium |

## Disaster-recovery recommendations
- **Backups:** confirm Supabase automated backups + **test a restore** into a scratch project (RPO/RTO unknown today — establish them).
- **Migrations:** introduce a staging/branch DB; apply + smoke every migration there first; keep a written rollback (down) for schema changes touching live tables.
- **Reconciliation:** a periodic job to detect partial states (e.g. orders with no items, `reserved` tickets never confirmed, stale `requested` stays) — also mitigates CID-02/03.
- **RPO/RTO:** define targets (e.g. RPO ≤ 24h from daily backup, RTO ≤ 2h) and validate by drill.
