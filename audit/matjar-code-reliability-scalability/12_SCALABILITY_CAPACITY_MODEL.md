# 12 — Scalability & Capacity Model

_Checkpoint 0. **No load test was run** (no staging — see `14`). Numbers below are **modeled estimates** from code + DB inspection, not measured. Every assumption is marked. Confidence is stated per row._

## Layer-by-layer

| Layer | Current | Likely first bottleneck | Failure mode | Horizontal scale | Confidence |
|---|---|---|---|---|---|
| Browser/client | 169 client components; leaflet/qr/jsbarcode eager (DEP-01) | Large route bundles on map/QR pages | Slow TTI on mobile | n/a (CDN) | Med |
| CDN (Vercel) | static + `next/image` | image transform volume (17) | cost, not failure | auto | Med |
| App (Vercel serverless) | SSR every dynamic route | store-page waterfall (PERF-01) adds serverless duration | timeout / cost under spike | auto (cold starts) | Med |
| **Postgres (Supabase)** | tiny data, mature indexes | **connection pool** under serverless fan-out; unbounded lists (PERF-02) | pool exhaustion → 500s | vertical + read replicas (plan-gated) | **Med-High** |
| Connection pool | Supabase pooler (pgBouncer) | serverless × per-request queries | "remaining connection slots" errors | pooler config | Med |
| Supabase Auth | default | login/signup spike | rate-limited | managed | Low |
| Storage | images/docs | bandwidth on unoptimized images (17) | cost | managed | Low |
| Realtime | **2 channels/signed-in page** (PERF-04) | concurrent WebSocket count | plan connection cap | plan-gated | **Med-High** |
| Notifications (web-push) | fire-and-forget | push fan-out volume | delivery lag | queue needed | Low |
| External | wa.me deep-links (no API) | none (client-side) | n/a | n/a | High |

**The two layers that fail first at scale: (1) Postgres connections / unbounded queries, (2) Realtime WebSocket count** (doubled by PERF-04).

## Capacity scenarios (modeled — NOT measured)

Assumptions (stated): ~15–25 ms/query RTT; store page ~12–18 sequential queries today (PERF-01); read:write ≈ 20:1 for a browse-heavy marketplace; each signed-in page = 2 realtime channels + 2 pollers (PERF-04).

| Scenario | Concurrent | Est. RPS | DB queries/s (approx) | Realtime channels | Modeled verdict | Confidence |
|---|---|---|---|---|---|---|
| **A — Early launch** (500 stores, 25 concurrent, 5 orders/min) | 25 | ~10–15 | ~150–300 | ~50 | **Ready** — well within Supabase small-plan headroom once PERF-01 batched | Med |
| **B — Growing** (2,500 stores, 150 concurrent) | 150 | ~60–90 | ~1–2k | ~300 | **Ready with conditions** — needs PERF-01/02 fixes + caching (CACHE-01…05) + realtime dedupe (PERF-04); watch pool | Low-Med |
| **C — National** (10,000 stores, 750 concurrent) | 750 | ~300–450 | ~5–9k | ~1,500 | **Not ready** until: query batching, pagination everywhere, sitemap chunking, connection-pool tuning/read-replica, realtime consolidation | Low |
| **D — Campaign spike** (2,000 concurrent, 200 read RPS, 20 write RPS) | 2,000 | 220 | ~3–4k read | ~4,000 | **Not ready** — sitemap/OOM (PERF-03), uncached offers/deals (CACHE-01), realtime count, pool bursts. Cache + CDN static variants required first | Low |
| **E — Extreme (5k VUs)** | 5,000 | — | — | — | **Unknown until tested** — requires staging + generated data | — |

## What must be true before each step
- **→ 500 stores (A):** batch the store-page waterfall (PERF-01); nothing else blocking. **Data-integrity fixes (CID-01/02/04) and SEC-01 should land regardless of scale** — they're not volume-gated.
- **→ 2,500 stores (B):** + PERF-02 pagination, CACHE-01…05, PERF-04 realtime dedupe, DB-02 FK indexes, orders composite (DB-03).
- **→ 10,000 stores (C):** + sitemap chunking (PERF-03), explore/near-me server-side pagination + PostGIS (PERF-08), connection-pool strategy / read replica, store_visits rollup + retention (DB-05), partitioning plan for orders/notifications (DB-04).

## Honest caveat
These are **desk estimates**. The true limits (RPS at p95<2s, connection ceiling, realtime cap, cold-start impact) **cannot be stated with confidence without a staging load test** (`13`). Do not quote a "supports N users" number from this document.
