# 28 — Implementation Roadmap

## 0. The numbers this roadmap is sized against

Read live from production on 2026-08-17. Every phase below is justified or rejected against these.

| | |
|---|---|
| Active stores | **13** (20 more suspended, 33 total) |
| Sectors with ≥1 active store | **5 of 17** — retail 7, services 2, healthcare 2, food 1, professional 1 |
| Sectors with **zero** active stores | **12** — automotive, hospitality, beauty, farm, fitness, realEstate, contractors, sportsCourts, events, petCare, pharmacy, education |
| Registered user profiles | **25** |
| Products | 65, across 19 stores |
| Orders — all time | **7**, across 3 stores. All 7 within the last 30 days |
| Bookings | 22, across 6 stores |
| Listings | 9 |
| Reviews | 5 |
| Page views, 30 days (`store_visits`) | **169** — 152 store, 17 product; 30 unique visitors |
| `search_logs` | **0 rows** |
| `saved_searches` | **0 rows** |
| Stores with any module override | **2 of 13** (7 rows total) |
| Stores with map coordinates | **3** |
| Products with a cost price | **0 of 65** |

**Against this, the platform ships:** 259 applied migrations, 119 tables, 436 functions, 289 RLS
policies, 141 routes, 266 components, 17 configured sectors, 35 merchant OS modules, a booking
engine, a stay engine, a ticketing engine, a lead engine, POS, inventory, accounting, HR, payroll,
attendance with WebAuthn clock-in, automations, campaigns, and a Capacitor native shell.

**The single most important sentence in this audit:** the build has run far ahead of the demand, and
almost every remaining engineering gap is a gap in something nobody is using yet. A roadmap that
proposes more engines makes the actual problem worse.

---

## 1. The three questions any phase below must answer

Before accepting any item, it must pass all three. I have applied this test to every proposal in this
document, including several I then rejected — those are in §7.

1. **Does a live merchant or buyer hit this today?** 13 stores, 30 visitors. If nobody hits it, it is
   not urgent no matter how correct.
2. **Does it get worse if we wait?** Correctness bugs, security holes and data-model decisions get
   worse (more rows to migrate, more code copying the wrong pattern). Scale features do not — they
   are cheaper to build later with real usage data.
3. **Would I still build it if the platform never grew past 50 stores?** If yes, build now. If it
   only pays off at 500 stores, it is Phase 4 at the earliest.

---

## Phase 0 — Correctness and guard-rails (≈ 2 days)

Everything here fails test 2: it gets worse if we wait. None of it is a feature.

| # | Item | Why now | Evidence | Size |
|---|---|---|---|---|
| 0.1 | Merchant sidebar honours `store_modules` | A merchant switching a module off sees it disappear from their storefront but stay in their dashboard. That is a bug they can hit today. | `merchant/[storeId]/layout.tsx:163-170` vs `store/[id]/page.tsx:209`; `27` §2.2 | 2h |
| 0.2 | `check` constraint on `business_types.slug` | The only guard is client-side (`business-type-manager.tsx:16-18`) and the anon key is committed at `supabase/config.ts:11`. A REST call bypasses it and crashes the storefront. | `27` §4.3.1 | 30m |
| 0.3 | Replace silent `?? "retail"` sector fallback with a visible unconfigured state | A misconfigured pharmacy silently rendering as a retail shop is worse than an error — nobody notices. | `merchant/[storeId]/layout.tsx:88`, `page.tsx:110`, `modules/page.tsx:50` | 1h |
| 0.4 | Constrain or filter `store_modules.module_key` | No constraint exists; the read policy is `using (true)`. | `0127_store_modules.sql`; `27` §4.3.3 | 30m |
| 0.5 | **Close `get_push_subs`' anon grant** | Returns push endpoints and keys for an arbitrary user id, protected only by a shared secret compared in SQL, granted to `anon`. `0196_emergency_hardening.sql:7` named it MJ-A02 and **explicitly deferred it**. Still open at `0271`. | `0049:31`, `0196:7` | 1–2h |
| 0.6 | **Scope `store-assets` storage INSERT to the uploader's store** | `store_assets_auth_insert` (`0008:10`) is `with check (bucket_id = 'store-assets')` and nothing else — any signed-in user may write into any store's folder. `0077:9-10` deferred the fix; still deferred. | `0008:10`, `0077:9-10` | 2–3h |
| 0.7 | Sweep for the `revoke … from public` no-op class | `0258` documents that `revoke from public` does not remove Supabase's `anon` grant, so six HR functions incl. `employee_clock` were anon-callable. Nobody has checked whether the same pattern exists elsewhere. | `0258` | 3h |
| 0.8 | Label paid placement in the UI | Applied at four independent points and disclosed nowhere. A trust problem at 13 stores as much as at 13,000. | `stores.ts:90, :221`, `market.ts:230`, `0098:89` | 2h |
| 0.9 | Verify `/icon.png` exists | Referenced by `manifest.ts:21-23` and `sw.js:10,105`; not in `public/`. If absent, PWA install icons 404. | `01` §14 | 15m |
| 0.10 | Fold the four sector `Set`s into `SectorConfig.transactionModel` | The last sector behaviour declared outside the registry, and the file it lives in already warns against exactly this coupling. Covered by existing tests. | `store-experience.ts:35-57`; `27` §2.1 | 1h |
| 0.11 | Write the `products` vs `listings` boundary as a short ADR | Costs an hour now; costs a migration later. Every feature built before this decision deepens the duplication. | `01` §5, `27` §6 | 1h |

**Phase 0 is not optional and it is not negotiable against anything else in this document.** 0.5 and
0.6 are live security holes that two prior hardening migrations consciously deferred and nobody
returned to.

---

## Phase 1 — Make the 13 real stores work better (≈ 2 weeks)

The audience is 13 merchants and 30 visitors a month. Everything here helps them specifically.

### 1.1 Instrument what is already instrumented (≈ 3 days)

Matjar has an analytics layer that is **written to and never read**. This is the cheapest high-value
work available.

- **`search_logs` has 0 rows.** `log_search` accepts six sections (`0216:86`) and is called from
  exactly one place — `explore-client.tsx:144`, `"products"` only. Wire the remaining five: `/search`,
  `/market`, `/jobs`, `/freelance`, `/wholesale`. **Cost: ~half a day.**
- **`admin_search_gaps` has no reader.** The migration that created it calls the zero-result report
  "the single most actionable thing this platform can know" (`0216:11-14`). Build the admin screen.
  With 25 users the data will be thin, but it starts accumulating from the day it is wired, and it
  is the only signal that says *which merchant to go and recruit*. **Cost: ~1 day.**
- **`hub_tool_events` is write-only.** Merchant tool usage is being collected and never looked at.
  One admin panel. **Cost: ~half a day.**
- **`content_reports` is entirely unused** — created with policies at `0216:165`, zero references in
  `src/`, no `report_content` RPC. Either wire the report button or drop the table. Leaving a
  security-relevant table half-built is the worst of the three options. **Cost: ~1 day, or 10
  minutes to drop.**

> **Why this ranks first.** With 169 page views a month, Matjar is not short of engineering — it is
> short of information. The instrumentation to answer "what did people look for and not find" is
> already built and merely unplugged.

### 1.2 Retention basics for the sectors that actually have merchants (≈ 4 days)

Retail (7), services (2), healthcare (2), food (1), professional (1). Nothing sector-exotic.

> **Two items I had listed here turned out to already exist**, which is worth recording because it is
> the pattern of this whole audit. **Reorder** is built — `src/components/reorder-button.tsx`,
> rendered at `orders/[id]/page.tsx:159`. **Back-in-stock notify** is built and wired end to end —
> `src/components/restock-button.tsx` → `join_stock_waitlist` RPC, with a merchant-side waitlist view
> at `merchant/[storeId]/items/page.tsx:103-107`. Neither needs building. **Always grep before
> scheduling.**

- **Merchant reply to reviews.** Genuinely missing, verified two ways: the `reviews` table has
  columns `id, store_id, customer_id, customer_name, rating, comment, created_at, updated_at` and no
  reply column, and there is no reply code in `store-reviews.tsx` or any review component. 5 reviews
  exist. A merchant who cannot answer a bad review has no reason to care about reviews — which is
  plausibly why review volume is 5. ~1–2 days including the migration. **This is the single
  highest-value item in Phase 1.2.**
- **Close the abandoned-checkout loop.** `checkout_intents` is written from
  `store-products.tsx:411` via `record_checkout_intent` and I found no read path. Either surface it
  to the merchant or drop the table. ~1 day, or 10 minutes to drop.

### 1.3 Merchant activation (≈ 3 days)

The most alarming number in the audit is **0 of 65 products have a cost price** — so the
margin/accounting engine (migrations `0204+`) computes on nothing. Second is **3 of 13 stores have
map coordinates**, so the location module is decorative for 10 of them.

Both are onboarding gaps, not engineering gaps. `sectorPrimarySetup()` (`sectors.ts:425-433`) and
`StoreChecklist` already exist as the mechanism — extend the checklist to cover cost price and map
pin, and surface the consequence ("without a cost price, your profit reports will read zero").

### 1.4 Native push actually delivers (≈ 3 days)

Today the native app collects FCM tokens into `device_push_tokens` and **there is no sender** — the
only two files referencing it are the bridge and its migration (`01` §11). A native user who grants
notification permission receives nothing. Either build the FCM HTTP v1 sender that
`MOBILE_APP.md:60-64` already scopes, or stop requesting the permission. Requesting a permission you
cannot honour trains users to deny it.

---

## Phase 2 — Prove one vertical, do not add any (≈ 4–6 weeks)

**The decision this phase forces:** twelve sectors have zero active stores and each has a
purpose-built engine. Matjar's constraint is not that it lacks engines — it is that it has never
recruited a merchant into one.

**Recommendation: pick exactly one zero-store sector, recruit 5–10 real merchants into it, and fix
only what those merchants break.** Do not build a thirteenth engine speculatively.

**Which one.** On the evidence, `beauty` or `fitness`:

- Both have a **complete, live engine already** — beauty routes to the appointment surface with a
  provider roster (`sectorHasTeam` is true), fitness has memberships + classes with real tables.
- Both are high-frequency, so the 22-booking base can grow visibly within the phase.
- Both are dense in Lebanon and reachable without a sales team.
- Crucially: **neither needs new architecture to start.** Compare with `hospitality` (needs rate
  plans), `events` (needs check-in/attendee), `automotive` (needs enumerated brands and range
  filters) — all of which would turn a go-to-market phase into a build phase.

The prior capability matrix (`docs/matjar-vertical-platform/04_VERTICAL_CAPABILITY_MATRIX.csv`)
already lists what each of these would need on contact — beauty: "staff pick + packages + deposit +
before/after"; fitness: "real membership ledger (expiry/renewal/sessions)". **Build those only when a
merchant asks.** That is what the matrix's own `build_trigger` column is for, and it is the right
instinct.

**Success criterion for the phase:** 5 merchants live in one sector, with bookings from customers
they did not already have. Not "the engine works" — it already does.

**If that criterion fails, no amount of Phase 3 helps.** That is the honest read.

---

## Phase 3 — Lift the query layer (≈ 4–6 weeks) — *gated*

This is `27` §5: the recurring finding that Matjar builds transaction engines and never exposes them
to discovery. Availability, stay dates, delivery zones, attributes and insurance all live one level
below where the marketplace needs them.

**It is the right architectural fix and it is genuinely the biggest gap in the product.**

**But it is gated, and the gate matters.** Today `/explore` fetches up to 200 stores and filters
them in the browser (`stores.ts:68, :84`; `explore-client.tsx:189-204`). With **13 active stores**,
that implementation is not merely adequate — it is *faster* than a server round trip and it supports
richer client-side interaction. The 200-row cap is 15× current supply.

**Gate: do not start Phase 3 until active store count exceeds ~60, or until Phase 2's recruited
sector produces a discovery query the current model genuinely cannot answer.**

When the gate opens, build in this order:

1. **Server-side paginated store/product query with the existing filters** — this is the enabling
   change; everything else hangs off it.
2. **Attribute facets platform-wide**, reading the same `attributes.ts` declaration the merchant
   form reads (`27` §5.1). Fix the two defects first: enumerate automotive `brand`
   (`attributes.ts:72`) and add range operators for `year`/`mileage`/`rooms`/`area`
   (`27` §5.2) — those are worth doing early regardless, because every listing created before the fix
   carries free-text brand data that has to be cleaned later.
3. **Availability-aware search** — "who is free tomorrow at 6pm". This is what turns Matjar from a
   directory into a booking marketplace and it is the single highest-value item in this document
   *once there is supply to search*.
4. **Delivery-zone filtering** — "who delivers to my address". The zone data already exists per store
   (`store_delivery_zones`, migration 0172).
5. **Cross-store stay search** — `search_stay` currently takes `p_store_id`
   (`stay-search.tsx:63`); a marketplace version drops that parameter. Only after a hospitality
   merchant exists.

---

## Phase 4 — Scale infrastructure (not scheduled)

Everything here is correctly diagnosed and **should not be built**. Listed so the diagnoses are on
record and so nobody re-derives them as urgent.

| Item | Diagnosis | Trigger to revisit |
|---|---|---|
| PostGIS / spatial indexing | Correct — distance is client-side Haversine over a capped window (`geo.ts:3-18`), no spatial extension exists | **3 stores have coordinates.** Fix data entry (Phase 1.3) first. Revisit past the 200-row cap |
| Learned / conversion-based ranking | Correct — every surface is recency + paid float; `searchStores` has no `.order()` at all (`stores.ts:178-199`) | Indistinguishable from perfect at 65 products. Revisit past ~2,000 products |
| Full-text search, Arabic normalisation in buyer search | Correct — `normalize_search()` exists (`0216:59`) but is not applied in `search_products_fuzzy`, `searchStores` or `getActiveListings` | Cheap enough to fold into Phase 3 step 1 |
| Two-sided / blind-release reviews | Correct in principle | 5 reviews exist. Rating integrity is not yet a real problem |
| Escrow, payments, buyer protection, deposits | Correct, and **strategic rather than technical** — see `30` §3 | Not an engineering decision |
| Courier tracking, live ETA | Correct | 7 orders. Revisit at meaningful order volume |
| Rate plans, seasonality, min-stay | Correct | Zero hospitality merchants |
| Listing expiry and duplicate detection | Correct | 9 listings |
| Merging `products` and `listings` | Correct that they duplicate | **Write the ADR (0.11); do not migrate.** Zero active stores in both listing-first sectors |
| Dynamic sector-definition engine / admin schema builder | **Rejected outright** — see `27` §4 and `30` §5 | Never, in this form |

---

## 5. What this roadmap deliberately does not contain

- **No new sector engines.** Twelve existing ones have no tenant.
- **No AI or recommendation system.** `bought_together` (`related.ts:41-59`) is already real
  co-purchase collaborative filtering and it feeds one product-page module. Use what exists.
- **No redesign.** Nothing in this audit found the visual or interaction layer to be the constraint.
- **No microservices, queues, caching layer, or read replicas.** 169 page views a month.
- **No migration of the two listing models.** Decision recorded, implementation deferred.

---

## 6. Sequencing summary

```
Phase 0  ~2 days      Correctness + 2 live security holes.  Unconditional.
Phase 1  ~2 weeks     Unplug the analytics; retention basics; merchant activation;
                      make native push deliver.  Serves the 13 real stores.
Phase 2  ~4-6 weeks   Recruit 5-10 merchants into ONE zero-store sector.
                      Build nothing except what those merchants break.
                      ── THE GATE ──
Phase 3  ~4-6 weeks   Server-side discovery + attribute facets + availability search.
                      Only after supply exists to search.
Phase 4  not scheduled
```

Phases 0 and 1 total roughly three weeks and are almost entirely finishing work on things already
built. Phase 2 is not an engineering phase at all — and that is the point.

---

## 7. Proposals I considered and rejected

Stated explicitly so the reasoning is auditable.

| Rejected | Why |
|---|---|
| "Build the events ticketing check-in flow" | `event_ticket_types` and `event_tickets` have zero rows and there are zero active events stores. The engine shipped and nobody arrived. |
| "Unify the five side marketplaces (`/market`, `/crafts`, `/freelance`, `/jobs`, `/wholesale`) into the sector system" | Architecturally attractive, enormous, and serves nobody today. Would touch the only surface that has working price filters and saved-search alerts. |
| "Add the remaining 13 sectors' attributes to `attributes.ts`" | 4 of 17 sectors have attribute vocabularies. The other 13 include 12 with zero merchants. Add a vocabulary when a merchant needs to enter into it. |
| "Merge `OsModuleKey` and `FeatureModuleKey` into one taxonomy" | They model different things — a customer-visible capability vs a merchant work screen. A nullable edge between them (`27` §2.2) is correct and 40× cheaper. |
| "Make the module manager additive so any store can enable any module" | 2 of 13 stores have ever touched it. The schema already supports it; only the UI restricts it. Change it when a merchant asks. |
| "Rebuild `/explore` with server-side filtering now" | The 200-row client-side approach is genuinely better at 13 stores. Gated to Phase 3. |
| "Add deposits to reduce no-shows" | There is no payment rail anywhere in the codebase and cash-first is an explicit strategy (`docs/PRODUCT_STRATEGY.md` §0). A deposit without a payment rail is not implementable. |
