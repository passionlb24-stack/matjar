# 11 — Caching Audit

_Checkpoint 0. Evidence `file:line`._

## Current caching (good foundation)
`unstable_cache` + tag-based invalidation is already used for the biggest public reads:

| Data | Location | Tags | TTL |
|---|---|---|---|
| Public store view | `store-view.ts:249` | `stores`, `store:<id>` | 300s |
| Public product view | `product-view.ts:164` | `products`, `product:<id>` | — |
| Public listing (market) | `market.ts:256` | `listings`, `listing:<id>` | — |
| Active store list | `stores.ts:73` | `stores` | 60s |
| USD/LBP rate | `settings.ts` | double-cached | — |
| Latest jobs / home counts | `home.ts:25,43` | | — |

Bounded correctly: `admin/orders` `.limit(100)`, reviews/questions `.limit(300)`, notifications `.limit(50)`, `STORE_FETCH_LIMIT=200`.

## Findings — hot public reads NOT cached (should be)
| ID | Data | Location | Backs | Severity |
|---|---|---|---|---|
| CACHE-01 | `getOffers` / `getClearance` / `getDailyDeal` | `offers.ts:17,62,114` (request-scoped client, no cache) | `/offers`, `/clearance`, home Deal rail | **P1** |
| CACHE-02 | `getBestSellers` | `best-sellers.ts:17` (uncached RPC) | `/best-sellers`, home teaser | P2 |
| CACHE-03 | `getAcademyGuides` | `academy.ts:40` (uncached) — also called by `sitemap.ts:95` | academy pages + sitemap | P2 |
| CACHE-04 | market taxonomy `getMarketCategories/Regions/Cities` | `market.ts:89,111,126` | every market page | P2 |
| CACHE-05 | `business_types`, `business_leaders` | several page/sitemap paths | leaders directory, sitemap | P3 |

These are **identical for every visitor** and recomputed per request against Postgres — prime cache candidates. All already use (or can use) the cookie-less public client.

## Recommendations
| Data | Cache | TTL | Invalidation | Staleness risk | Privacy |
|---|---|---|---|---|---|
| offers/clearance/daily-deal | `unstable_cache` | 60–120s | tag `products` | low (price/flash windows) | none (public) |
| best-sellers | `unstable_cache` | 300s | tag `products`/`stores` | low | none |
| academy guides | `unstable_cache` | 600s | tag `academy` (on admin edit) | low | none |
| market taxonomy | `unstable_cache` | 3600s | tag `market` (on admin edit) | very low | none |
| business types | `unstable_cache` | 3600s | manual bust | very low | none |

Reuse existing tags (`products`, `stores`, `listings`) so current bust paths cover the new cached reads.

## Must NOT cache (verified not cached — correct)
Customer orders, merchant dashboards, private messages, drafts, private bookings, admin data, verification documents, anything behind `auth.getUser()`. The store page is correctly dynamic (reads cookies for the logged-in viewer) — only its **public sub-view** (`getPublicStoreView`) is cached.

## Layer coverage
- **Route/data cache (Next):** partial — see findings. Add the CACHE-01…05 wrappers.
- **CDN (Vercel):** static assets + `next/image` served via CDN. Public dynamic routes are SSR (not statically cached) because they read cookies via the layout — a candidate for splitting a fully-public variant, but out of scope for Checkpoint 0.
- **Browser cache:** default Next headers; PWA manifest present.
- **Image cache:** `next/image` optimization — but note several `no-img-element` disables (data-URI/generated images) bypass it (see `17` cost risks).
- **DB cache:** Postgres shared buffers — not app-controlled.
