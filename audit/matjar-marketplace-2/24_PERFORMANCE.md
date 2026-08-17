# 24 — Performance

## 0. What this document is, and what it cannot be

**Nothing here is a measurement of the running application.** No Lighthouse
score, no LCP/INP/CLS, no transferred-bytes figure, no server timing, no
`EXPLAIN` plan. The browser pane cannot composite this app
(`audit/matjar-mobile-app-experience/18_BEFORE_AFTER.md`), no production session
is available, and the prior audit already established that this Next
configuration does not print per-route First Load JS
(`audit/matjar-mobile-app-experience/15_PERFORMANCE.md`) — which is exactly why
M-017 was deferred rather than asserted.

So this document does two things:

1. States what **can** be established statically — module graphs, line counts,
   query shapes, cache boundaries, index coverage, image handling — and treats
   those as structural facts, not as performance numbers.
2. States precisely **what tooling would be needed** to turn each of them into a
   number, so the next session measures instead of guessing.

Every "large", "heavy" or "expensive" below means *large in source*, not *large
in bytes*. A 1,600-line component is not necessarily 1,600 lines of shipped
JavaScript. That conversion needs a bundler report and is not made here.

---

## 1. The one structural finding that dominates the rest

### `/store/[id]` ships every sector's transaction UI to every sector's customer

`src/app/[lang]/(site)/store/[id]/page.tsx` is a server component. It statically
imports the whole feature set, and `src/components/store/store-products-section.tsx`
(also a server component) statically imports two more at lines 12–13.

Client components reachable from that one route, by source size:

| Lines | Component | Rendered for |
|---|---|---|
| 1,623 | `src/components/store-products.tsx` | retail / food / pharmacy / farm — catalogue **+ cart + checkout + confirmation** |
| 1,303 | `src/components/booking-panel.tsx` | healthcare / beauty / education / petCare / professional |
| 363 | `src/components/service-request-form.tsx` | services / contractors |
| 309 | `src/components/stay-search.tsx` | hospitality |
| 284 | `src/components/timeslot-booking.tsx` | sportsCourts |
| 194 | `src/components/reservation-form.tsx` | food |
| 194 | `src/components/classes-booking.tsx` | fitness |
| 193 | `src/components/event-tickets.tsx` | events |
| 155 | `src/components/lead-form.tsx` | realEstate / automotive |
| 88 + 28 | `store-map.tsx` + `store-map-client.tsx` | all — **the only one behind `next/dynamic`** |
| 69 / 69 / 67 / 54 / 36 | `track-visit`, `follow-button`, `share-button`, `message-store-button`, `back-button` | all |
| **≈ 5,029** | **total client TSX reachable from one route** | |

A butcher's storefront and a hotel's storefront are the same route. Because the
imports are static, both pull the same client module graph — the hotel's
date-range search, the event-ticket purchase flow, the class booker and the
1,623-line cart/checkout component all sit in the bundle for a customer who is
looking at meat.

`resolveStoreExperience` (`src/lib/store-experience.ts`) already decides at
**render** time which of these to show. Nothing decides at **load** time.

**Why this is the top item.** It is the only performance issue on the customer's
critical path that is (a) certain from source, (b) sector-multiplied — it gets
worse with every sector added, not with every store added — and (c) fixable
without touching the money path.

**Fix, and why this one is safe where M-017 was not.** M-017 was deferred
because splitting checkout *out of* `store-products.tsx` means relocating cart,
coupon, loyalty, zone, custom-field and idempotency state across a component
boundary on the order-submit path. That reasoning still holds.

But this is a different change: leave every component exactly as it is and swap
nine static imports for `next/dynamic`, keyed on the sector the page already
computed. No state moves. No component is restructured. The money path is not
edited. The pattern is already in the repo — `store-map-client.tsx` does exactly
this for Leaflet.

**Verification required:** a bundler report before and after. Do not claim a win
without one — see §6.

---

## 2. Client/server split, more broadly

- 195 of 210 top-level files in `src/components/` carry `"use client"`.
- The 25 largest components are all client components; the top ten are
  1,623 / 1,303 / 1,059 / 949 / 825 / 808 / 757 / 752 / 665 / 663 lines.

Most of these are merchant-dashboard managers (`attendance-manager` 1,059,
`hr-manager` 949, `automation-manager` 825, `crm-manager` 808, `clock-device`
757), which is a defensible place for client code: a merchant on a dashboard is
a return visitor on a warm cache, and the screens are genuinely interactive.

The customer path is the concern, and there it is narrower than the raw count
suggests: `store-products.tsx` and `booking-panel.tsx` are the two that matter,
and §1 addresses both.

**One note on `booking-panel.tsx`.** The prior audit recorded it at 889 lines; it
is now **1,303** — it grew by ~47% when the step flow shipped for M-014. That
was the right feature. It is also the pattern to watch: the mobile pass improved
composition by adding client code, and nothing measured the cost. That is the
gap this document exists to close.

---

## 3. Images

**Handling is good.**

- `next/image` is imported in 50 files, 99 `<Image` usages across 55 files.
- 46 explicit `sizes=` props and 22 `priority` usages — so the responsive
  descriptor and LCP hinting are being used deliberately, not by accident.
- `next.config.ts:35–43` restricts `remotePatterns` to one Supabase host and one
  path prefix. Correct and tight.
- Upload guardrails exist at the storage layer:
  `supabase/migrations/0077_security_hardening.sql:11–16` sets a 5 MiB file-size
  limit and restricts MIME types to jpeg/png/webp/gif/avif on `store-assets`.

**Eight raw `<img>` remain**, all bypassing optimisation, resizing and the
implicit lazy-loading Next adds:

| File | Lines |
|---|---|
| `src/app/[lang]/(site)/hub/leaders/[slug]/page.tsx` | 133, 149, 342 |
| `src/components/hub/leaders-directory.tsx` | 222 |
| `src/app/[lang]/(dashboard)/admin/leaders/page.tsx` | 80 |
| `src/components/store-portfolio.tsx` | 41 |
| `src/components/store-share-card.tsx` | 52 |
| `src/components/product-story-card.tsx` | 182 |

Four of the eight are the Leaders feature, and three of those are on a **public**
page (`/hub/leaders/[slug]`). `store-share-card` and `product-story-card` render
to a canvas for share images, where a raw `<img>` is the correct choice —
`next/image` output cannot be drawn to canvas cleanly. `store-portfolio.tsx:41`
and the Leaders pages are ordinary content images and should be `next/image`.

**Not used anywhere:** `placeholder="blur"` (0 occurrences). For a marketplace
whose store cards are image-first on a Lebanese mobile connection, blur
placeholders are the cheapest perceived-performance win available and they also
reduce layout instability. Worth adding to `StoreCard` and the product cards
specifically.

**`src/components/site-header.tsx:55` sets `unoptimized`** on the logo. Probably
deliberate for a small PNG; worth confirming it is not the only reason the header
image is unoptimised on every route.

---

## 4. Query patterns and the PostgREST 1000-row cap

Supabase's PostgREST silently caps a response at 1000 rows. A query without
`.limit()` or `.range()` does not error when it truncates — it returns 1000 rows
and the application believes that is everything.

### What is bounded (good)

`src/lib/data/` is mostly disciplined:

| Bound | Where |
|---|---|
| `.limit(50)` × 4 | `activity.ts:50, 58, 64, 70` |
| `.limit(100)` | `product-reviews.ts:34` |
| `.limit(50)` | `product-qa.ts:22` |
| `.limit(STORE_FETCH_LIMIT)` = 200 | `stores.ts:84`, constant at `stores.ts:68` |
| `.limit(24)` | `stores.ts:194` (store search) |
| `.limit(limit)` | `home.ts:33`, `offers.ts:87, 112`, `related.ts:78, 112`, `stores.ts:216` |
| `.range(offset, offset+limit-1)` | `market.ts:245` — **the only real pagination in the whole data layer** |

`stores.ts:64–68` even carries the reasoning in a comment: bounded at 200,
client-side filtering within that window, "raise or move to server-side
pagination / PostGIS nearest-search when store count nears it." That is the right
way to defer a decision.

### What is unbounded, ranked by when it will actually bite

| # | Query | File:line | Failure mode |
|---|---|---|---|
| 1 | `product_variants` `.in("product_id", allProductIds)` for a whole store | `store-view.ts:165–171` | **One row per variant across every product in the store.** A 300-product store averaging 4 variants passes 1000. The truncation silently marks products as variant-free, which — per the in-file comment — routes them down the wrong add-to-cart path. A **correctness** bug wearing a performance costume. |
| 2 | `products` for a whole store, 16 columns | `store-view.ts:120–128` | The storefront stops showing products past 1000, with no error, plus a very large single payload |
| 3 | `bundle_items` `.in("bundle_id", …)` | `store-view.ts:140–144` | scales with bundles |
| 4 | `listings` `.eq("seller_id", …)` in `getMyListings` | `market.ts:342–346` | a power seller's list truncates; the function signature has no pagination at all |
| 5 | `follows` `.eq("user_id", …)` in `markFavorites` | `stores.ts:149–151` | a user following >1000 stores gets wrong "saved" states |
| 6 | `store_locations` `.in("store_id", ids)` | `stores.ts:110–113` | bounded indirectly at ≤200 stores × branches, so ~5 branches each is the ceiling |

Plus 14 lower-risk unbounded reads over taxonomy and per-item config
(`market.ts:97, 128, 153`, `crafts.ts:66, 71, 94`, `academy.ts:46`,
`product-view.ts:73, 78, 83, 94`, `store-view.ts:179, 185`).

**At today's scale — 11 stores, 65 products — none of these can trigger.** That
is the honest statement, and it is also why they should be fixed now: the fix is
five minutes each while the tables are empty, and it is a production incident
once they are not. #1 in particular fails as a **wrong price/wrong variant**, not
as a slow page.

**Fix:** a shared `assertNotTruncated` helper, or simply an explicit
`.limit(N)` on every one of them with an N that makes truncation visible in logs.

### Caching

`unstable_cache` is used at eight call sites with deliberate revalidate windows —
60s for the active-store listing (`stores.ts:96`), 120s for a market listing
(`market.ts:293`), 300s for best-sellers and jobs, 600s for academy guides and
home counts, 3600s for market taxonomy. The heaviest public query is behind the
shortest window with a `stores` tag. This is well-judged and is the single
biggest reason the home page is cheap.

`attachLocations` (`stores.ts:103–113`) is run **inside** the cached function
with a cookie-less client, correctly, because `unstable_cache` cannot read
request cookies. The comment says so. Good.

### Indexes

**228 `create index` statements** across the migrations, including targeted
partial indexes on the hot paths — e.g.
`checkout_intents_scan_idx on (store_id, updated_at) where notified_at is null`
(`0120_abandoned_cart.sql:43–45`). Index coverage was **not** validated against
actual query plans, and cannot be from here. What can be said: this is not a
schema where indexing was forgotten.

---

## 5. Server-side aggregation

Aggregation is pushed into Postgres RPCs rather than pulled into Node:
`get_best_sellers` (`0031`), `search_products_fuzzy`, `bought_together`,
`store_audience` (`0161:93–190`), `store_margin_report` (`0210`),
`store_delivery_report` (`0213:273`). `best-sellers.ts:24` and `crafts.ts:131`
pass `p_limit` so the bound lives in the SQL.

This is the correct shape and it is also why the 1000-row cap is not a bigger
problem than §4 describes — the queries that would return the most rows are
already aggregates.

---

## 6. What must be measured, and with what

Nothing above becomes a performance claim until these run. Listed with the
smallest viable tool for each.

| Question | Tool | Note |
|---|---|---|
| Per-route First Load JS; what §1 actually costs | `@next/bundle-analyzer` wired into `next.config.ts`, run on `next build` | The prior audit deferred M-017 precisely because this was missing. **Wire it first — it unblocks every other performance decision.** |
| LCP / INP / CLS on real devices | Vercel Speed Insights (the project already ships `@vercel/analytics`; Speed Insights is the sibling package) or field CrUX | Field data beats lab data for a Lebanese mobile audience on variable 3G/4G |
| Lab LCP/TBT per route | Lighthouse CI against a preview deployment, budget file committed | Gives a regression gate, not a headline number |
| Whether §4's unbounded queries truncate | one `select count(*)` per table against production | Trivial; also settles whether #1 and #2 are theoretical today |
| Query plans and slow queries | `pg_stat_statements` + `EXPLAIN (ANALYZE, BUFFERS)` on the top 10 | Supabase exposes this in the dashboard |
| Image bytes actually served | `read_network_requests` in a working browser session, or the Vercel image-optimisation usage report | Also settles whether `unoptimized` on the logo matters |
| Whether the SW helps or hurts repeat loads | DevTools Application panel on a real device | The prior audit could not register a worker at all in this environment |

**Suggested first budget**, to be validated not adopted blindly:
`/` and `/store/[id]` under 200 KB First Load JS, LCP under 2.5 s on a
throttled 4G profile. Set it after the analyser prints the current number, not
before.

---

## 7. Summary

| # | Finding | Type | Severity |
|---|---|---|---|
| 1 | `/store/[id]` statically imports every sector's transaction UI (~5,029 client lines reachable) | structural, certain | high |
| 2 | `product_variants` fetched unbounded per store — truncation is a **correctness** bug | correctness | high (latent) |
| 3 | Store product list unbounded | correctness | medium (latent) |
| 4 | No bundle analyser wired; no per-route JS number exists | tooling | high |
| 5 | `getMyListings`, `markFavorites` unbounded | correctness | medium (latent) |
| 6 | 8 raw `<img>`, 3 on a public page | perf | low |
| 7 | No `placeholder="blur"` anywhere on an image-first marketplace | perf/CLS | low |
| 8 | `booking-panel.tsx` grew 47% in the mobile pass with no measurement | process | medium |

## 8. What could not be verified

- Any byte count, any timing, any Core Web Vital, any Lighthouse score.
- Whether the unbounded queries truncate today (needs one count query).
- Whether index coverage matches the real query plans.
- Whether the service worker improves or degrades repeat navigation.
- Whether Turbopack tree-shakes any of the §1 client components that are
  imported but never rendered. **This is the one assumption in §1 that could
  change the conclusion** — it is stated as certain that they are *imported*, and
  as unverified whether they are *shipped*. The analyser settles it.
