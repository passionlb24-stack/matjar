# 21 — Prioritized Action Plan

_Checkpoint 0 recommendation. Nothing here is implemented — all items await approval (Checkpoint 3). Ordered by the prioritization framework: data exposure/loss → cross-tenant → duplicate/oversell → breaks-checkout → crashes-under-growth → all-users → publicly-exploitable → worse-with-data → hard-to-detect → reusable._

## EMERGENCY (data exposure / integrity — fix before any go-live, NOT volume-gated)
| # | Item | Issue | Effort |
|---|---|---|---|
| 1 | Close `store_verifications` public read: `using(status='verified')`, hide `doc_url`/`number` from anon | MJ-A01 (High) | S |
| 2 | Add partial unique indexes on `store_memberships`/`course_enrollments`; INSERT becomes the guard | MJ-R01/MJ-D01 (High) | S |
| 3 | Fix coupon over-redemption: conditional `used_count` bump | MJ-R04 (High) | M |
| 4 | Rate-limit `place_stay_booking` + `buy_tickets`; expire stale reserved/requested rows | MJ-R02/R03/S01 | S |
| 5 | Restrict `get_push_subs` (revoke anon, service role only, rotate secret) | MJ-A02 (Med) | S |
| 6 | Add idempotency key to product-page order | MJ-R09/FE-04 | S |

## BEFORE PUBLIC GROWTH (works at low traffic, fails as it grows)
| # | Item | Issue | Effort |
|---|---|---|---|
| 7 | Add error tracking (Sentry/APM) + basic alerts | MJ-O01/O02 (High ops) | M |
| 8 | Stand up a staging/branch DB; rehearse migrations there; write down-scripts for live-table changes | MJ-REC01 (High) | M |
| 9 | Paginate merchant orders + store reviews + admin stores/users | MJ-P02 (High) | M |
| 10 | Batch the store-page query waterfall into `Promise.all` waves | MJ-P01 (High) | M |
| 11 | Chunk + cache the sitemap (`generateSitemaps`) | MJ-P03 (High) | M |
| 12 | Consolidate the duplicate realtime channels + pollers | MJ-P04 (High) | M |
| 13 | Cache hot public reads (offers/clearance/best-sellers/academy/market) | MJ-P05 (Med) | S |
| 14 | Re-scope new-engine RLS to `staff_can(section)` | MJ-A03 (Med) | M |
| 15 | Add the concurrency/RPC/RLS test harness; run the contention suite | MJ-T01 (High) | L |

## SHORT TERM (within a month)
| # | Item | Issue |
|---|---|---|
| 16 | FK covering indexes (17) + `orders(store_id,status,created_at)` composite | MJ-D02/D03 |
| 17 | Fix `pos_record_sale` atomic stock + `record_order_payment` lock | MJ-R06/R05 |
| 18 | Generate + wire Supabase `Database` types (kills 113 casts) | MJ-C01 |
| 19 | `next/dynamic` for leaflet/qrcode/jsbarcode; bump pinned next/react patches | MJ-DEP01/DEP02 |
| 20 | message-thread visibility gate + limit; store-view internal `Promise.all` | MJ-P06/P07 |
| 21 | Verify push API-route auth + JSON-LD escaping; enable leaked-password protection | MJ-S03/S02/S04 |

## MEDIUM TERM (scaling foundations)
- Move hardcoded slugs into `sectorConfig` capability flags (MJ-C02).
- Server-side pagination + PostGIS nearest for explore/near-me (MJ-P08).
- `store_visits` rollup + retention; partitioning plan for orders/notifications (MJ-D04/D05).
- Connection-pool strategy / read replica; break up god components.
- Backup-restore drill; define RPO/RTO (MJ-REC02).

## LONG TERM
- Consider extracting the most safety-critical business logic into tested service functions; formalize the sector registry as the single source of truth; evaluate a queue for notification fan-out.

## Reusability note
Items 1–6, 13, 16, 18 are **one-shot, platform-wide** fixes (a single migration or config change protects every sector). Prioritize those for best ROI.
