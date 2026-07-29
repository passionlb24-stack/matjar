# 10 — Performance Audit (application layer)

_Checkpoint 0. Evidence = `file:line`. DB-engine/index side is in `06_DATABASE_AUDIT.md`. Severity: **P1** degrades sharply with data/traffic; **P2** meaningful; **P3** hygiene. No production load test was run (no staging — see `14`)._

## Queries-per-page (heavy pages)

| Page | DB round-trips/render | Parallel? | Note |
|---|---|---|---|
| Store `store/[id]/page.tsx` | ~13 min → ~23 worst | **Sequential waterfall** | `getPublicStoreView` cached but +~17 sequential awaits after |
| Merchant dashboard `merchant/[storeId]/page.tsx` | ~19–22 | Mostly parallel (16-way `Promise.all`) | Best-structured heavy page |
| Merchant orders `orders/page.tsx` | 7 | Sequential | orders list **unbounded**; sub-lists batched via `.in()` (no N+1) |
| Home `(site)/page.tsx` | ~8–10 | Parallel Suspense islands | Mostly cached — good |
| Explore | 2 | Parallel | cached 60s, capped 200 rows |
| Search | 4 | Parallel | uncached (query-dependent, acceptable) |
| Site layout (every page) | 4–5 (signed-in) | Partly parallel | auth+profile+notif+msg on every nav |

## Findings

| ID | Title | Severity | Evidence |
|---|---|---|---|
| PERF-01 | Store page = ~17 independent `await` calls run **sequentially** (additive RTT ~250–500ms) | **P1** | `store/[id]/page.tsx:155-479` |
| PERF-02 | Unbounded list queries (no `.limit`/`.range`): store reviews, merchant orders, admin stores, admin users | **P1** | `store/[id]/page.tsx:161`, `orders/page.tsx:72`, `admin/stores/page.tsx:34`, `admin/users/page.tsx:25` |
| PERF-03 | `sitemap.ts` enumerates **all** stores+products+listings+jobs+… **× every locale**, unbounded, in one request | **P1** | `src/app/sitemap.ts:56-171` |
| PERF-04 | Duplicate realtime channels + pollers: `RealtimeNotifications` **and** `HeaderBells` each open a `notifications` channel + a 20s poll, both mounted in both layouts → 2 sockets + 2 polls per signed-in page | **P1** | `realtime-notifications.tsx:49`, `header-bells.tsx:65`, both layouts |
| PERF-05 | Hot public reads not cached: `getOffers`/`getClearance`/`getDailyDeal`, `getBestSellers`, `getAcademyGuides`, market taxonomy — recomputed per request | **P1/P2** | `offers.ts:17`, `best-sellers.ts:17`, `academy.ts:40`, `market.ts:89` (see `11_CACHING`) |
| PERF-06 | `message-thread.tsx` polls the **entire** message list every **4s** with no `.limit` and no visibility gate | P2 | `message-thread.tsx:41` |
| PERF-07 | `getPublicStoreView` internal reads are sequential (store→products→sections→checkout_fields) | P2 | `store-view.ts:96-158` |
| PERF-08 | Explore/category/"near me" filter + distance-sort the full 200-store array **client-side** (hard 200 cap) | P2 | `stores.ts:63-101`, `ExploreClient` |
| PERF-09 | Merchant dashboard: `store_visits_summary` + `primarySetup` count run outside the main `Promise.all` | P3 | `merchant/[storeId]/page.tsx:371,587` |

### PERF-01 (P1) — store page waterfall
After `loadStore`, the top SEO page fires ~17 independent reads one-by-one: reviews, verifications, store_modules, resources, membership_plans, classes, portfolio, courses, doctors+service_providers, follows, usd/lbp rate, fulfilled count, profile, addresses, delivery_zones, couriers, locations, my_loyalty. Latency is additive and grows with every module a store enables. **Fix:** batch independent reads into 2–3 `Promise.all` waves (module-gated ones after `store_modules`).

### PERF-02 (P1) — unbounded lists
Store `reviews` and merchant `orders` are fetched in full on every render with `.order()` but no bound; both grow forever. Admin `stores`/`users` fetch the whole platform. Note: `admin/orders` (`.limit(100)`), reviews/questions (`.limit(300)`), notifications (`.limit(50)`), and `stores.ts` (`STORE_FETCH_LIMIT=200`) **are** bounded — the pattern exists, just not applied here. **Fix:** paginate reviews + merchant orders + admin lists.

### PERF-03 (P1) — sitemap
`products.select("id, updated_at")` with no limit × 2 locales = 200k entries built in memory at 100k products; also exceeds the 50k-URL sitemap spec. **Fix:** `generateSitemaps` index + chunked/paginated + `.range()` + cache.

### PERF-04 (P1) — realtime duplication
Per signed-in page: **2 realtime channels + 2 polling intervals** on the same `notifications` filter (both components mounted in both layouts). At scale this doubles WebSocket connections (a Supabase Realtime limit/cost driver) and doubles poll load platform-wide. **Fix:** one channel + one poller; share counts via context.

## Highest-leverage (ordered)
1. Store-page waterfall (PERF-01) — biggest single latency win on the top SEO surface.
2. Unbounded reviews + merchant orders (PERF-02) — before those tables grow.
3. Sitemap pagination (PERF-03) — before catalog scale makes it fail/OOM.
4. Cache hot public reads (PERF-05) — removes per-request Postgres from `/offers`,`/clearance`,`/best-sellers`, home rails, market.
5. Dedupe notification channels/pollers (PERF-04) — halves WS + poll load per user.
