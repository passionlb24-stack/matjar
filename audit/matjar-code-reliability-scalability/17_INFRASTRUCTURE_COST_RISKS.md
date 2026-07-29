# 17 — Infrastructure & Cost Risks

_Checkpoint 0. No secrets exposed. Exact pricing not available → cost expressed as drivers + relative ranges, not dollar figures._

## Infrastructure model (inferred)
- **Hosting:** Vercel (Next.js serverless/edge; push-to-`main` deploy). Function concurrency + duration limits apply per plan.
- **Data:** Supabase (Postgres + PostgREST + Auth + Storage + Realtime). Connection pool, storage, realtime connections, and egress are plan-gated.
- **CDN:** Vercel edge for static + `next/image`.
- **Mobile:** Capacitor hosted-hybrid (loads the live site) — no separate backend.

## Cost drivers & explosion risks
| Risk | Driver | Severity | Evidence |
|---|---|---|---|
| COST-01 | **Uncached hot public reads** → per-request Postgres + serverless duration on `/offers`,`/clearance`,`/best-sellers`, home rails, market | High | CACHE-01…05 |
| COST-02 | **Store-page waterfall** → long serverless execution × every store view (top SEO traffic + bots) | High | PERF-01 |
| COST-03 | **Sitemap enumerates all rows × locales** → expensive/OOM-prone generation; bot crawls hit it repeatedly | High | PERF-03 |
| COST-04 | **Doubled realtime channels** → 2× WebSocket connections platform-wide (realtime is a hard plan cap + cost driver) | High | PERF-04 |
| COST-05 | **Unoptimized/`no-img-element` images** (data-URI, generated) bypass `next/image` → storage bandwidth | Medium | 8 `no-img-element` disables (DEP/CQ) |
| COST-06 | **`store_visits` analytics stored indefinitely**, no rollup/retention | Medium | DB-05 |
| COST-07 | **Bot traffic on dynamic store/product pages** (uncached, cookie-dynamic) → serverless + DB per crawl | Medium | see `24 SEO` |
| COST-08 | **Notifications/audit_logs/order_events grow unbounded**, no retention | Low | DB-04 |

## Relative cost by scale (categories, not $)
| | 500 stores | 2,500 stores | 10,000 stores |
|---|---|---|---|
| Serverless invocations | Low | Medium — **fix COST-01/02 or it climbs fast** | High — caching mandatory |
| DB compute/connections | Low | Medium | High — pool tuning / read replica |
| Realtime connections | Low | Medium — **fix COST-04 first** | High |
| Storage/bandwidth | Low | Medium | Medium-High — image optimization (COST-05) |
| Egress (sitemap/bots) | Low | Medium | High without COST-03 fix |

## Biggest levers (do these and cost stays sub-linear)
1. Cache the hot public reads (CACHE-01…05) — cuts COST-01 and much of COST-02/07.
2. Batch the store-page waterfall (PERF-01) — cuts serverless duration on the highest-traffic route.
3. Consolidate realtime (PERF-04) — halves the realtime connection bill.
4. Chunk/cache the sitemap (PERF-03) — removes an OOM + egress risk.
5. `store_visits` rollup + retention (DB-05) — bounds analytics storage.

_Confidence: Medium. Exact costs require the Vercel + Supabase plan/usage data (not accessed)._
