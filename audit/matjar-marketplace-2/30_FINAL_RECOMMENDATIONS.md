# 30 — Final Recommendations

Ranked. Each item states what to do, why, the evidence, and what it costs. Section 5 states what I
would explicitly **not** do, which is the more useful half of this document.

---

## The one-sentence version

Matjar's problem is not that its architecture is too generic — it is that a genuinely sophisticated
17-sector platform has been built for a market that has not yet arrived, and the next unit of effort
should go into information and merchants rather than into more engines.

---

## 1. Close the two security holes that two prior hardening passes consciously deferred

**Rank 1 because they are the only items here where waiting has a cost that is not recoverable.**

- **`get_push_subs(uuid, text)`** (`0049_push_on_events.sql:31`) returns push endpoints and encryption
  keys for an arbitrary user id, protected only by a shared secret compared in SQL, and is granted to
  `anon`. `0196_emergency_hardening.sql:7` identified it as finding MJ-A02 and **explicitly declined
  to fix it** ("tracked separately"). No later migration revokes it. **Verified live during this
  audit: `pg_proc.proacl` shows EXECUTE granted to `anon` in production right now** — this is not
  merely an in-repo condition. (`clock_store_context` is likewise anon-granted, which is intentional
  — the WebAuthn assertion is the real check — but it means an unauthenticated POST reaches a
  service-role RPC at `api/clock/punch/route.ts:41`.)
- **`store_assets` bucket INSERT is unscoped.** `store_assets_auth_insert` (`0008_storage_bucket.sql:10`)
  is `with check (bucket_id = 'store-assets')` and nothing else — any authenticated user may write
  objects into any store's folder. `0077_security_hardening.sql:9-10` recorded that per-user path
  scoping was deferred because upload paths key on `storeId` rather than uid. **Still deferred at
  `0271`.**
- **And sweep the `revoke … from public` no-op class.**
  `0258_actually_revoke_anon_from_hr_functions.sql` documents that `revoke all … from public` does
  **not** remove Supabase's direct `anon` grant, so the revokes in `0248`, `0254` and `0256` were
  no-ops and six HR functions including `employee_clock` were anon-callable. Nobody has checked
  whether that pattern exists elsewhere. 19 SECURITY DEFINER functions are currently anon-executable.

**Cost: ~1 day.** **Why now:** these are the only findings in this audit that a third party could
exploit today, and both were consciously left open by engineers who intended to return.

**Credit where due:** the surrounding security posture is strong. 289 policies, 0 tables without RLS,
and **286 of 286 SECURITY DEFINER functions set `search_path`** — that last figure is unusually
clean and reflects real discipline.

---

## 2. Unplug the analytics that are already built

Matjar collects data it never reads. This is the cheapest high-value work available and it is the
prerequisite for every judgement in §4.

| Table | State | Fix |
|---|---|---|
| `search_logs` | **0 rows.** `log_search` accepts six sections (`0216:86`); called from one place, `explore-client.tsx:144`, `"products"` only | Wire `/search`, `/market`, `/jobs`, `/freelance`, `/wholesale` |
| `admin_search_gaps` | No reader anywhere in `src/` | Build the admin screen. `0216:11-14` calls the zero-result report "the single most actionable thing this platform can know" and it is right |
| `hub_tool_events` | Write-only | One admin panel |
| `content_reports` | Created with policies at `0216:165`; **zero references in `src/`**, no `report_content` RPC | Wire the report button **or drop the table**. A half-built moderation table is the worst state |
| `checkout_intents` | Written from `store-products.tsx:411`; no read path found | Surface or drop |

**What already works and should be built on, not replaced:** `store_visits` is real, live view
tracking on **both** store and product pages (`track-visit.tsx`, mounted at `store/[id]/page.tsx:513`
and `product/[id]/page.tsx:219`) — de-duped per session, bot-filtered, no PII. 169 views in 30 days.
The gap is not view tracking; it is that there is no event past a view (no add-to-cart, no
checkout-start, no filter-applied) and no impression tracking.

**Cost: ~3 days.** **Why now:** with 30 monthly visitors, Matjar is not short of engineering. It is
short of information about what those 30 people wanted and did not find. The instrumentation is
built and merely unplugged.

---

## 3. Make the strategic decision about money, explicitly

This is not an engineering recommendation. It is the fork that determines which of everything else
matters.

Matjar has **no payment processing anywhere in the codebase**. Cash-on-delivery and WhatsApp are an
explicit, documented strategy (`docs/PRODUCT_STRATEGY.md` §0, principle 2: "no complex online
payment at the start — Lebanon is cash + WhatsApp; we build around that, not against it"). For the
Lebanese market that is a defensible and probably correct read.

**But it has a consequence that should be faced deliberately, not drifted into.** Without holding
the money, Matjar cannot:

- take a transaction fee (so revenue is capped at the SaaS subscription that `plan-tiers.ts` already
  builds — $10 / $25 / $65 per month);
- charge a booking deposit, which is the mechanism that fixes no-shows and the main reason
  appointment merchants tolerate a platform commission;
- offer buyer protection or enforce a refund, which is the platform-level promise that makes a
  marketplace worth more than the sum of its sellers.

**Both paths are legitimate:**

- **Path A — SaaS.** Matjar is a Business OS that merchants pay a subscription for, with a
  marketplace attached for acquisition. **This is what the codebase currently is**, and it is by far
  the stronger half: 35 OS modules, POS, inventory, accounting, HR, payroll, attendance with WebAuthn
  clock-in, automations, suppliers, kitchen display. That is substantially more than Fresha, Booksy
  or Eventbrite ship. If this is the answer, then §4 changes shape and the merchant tools become the
  roadmap.
- **Path B — marketplace with a take rate.** Requires a payment rail, which in this market means
  solving a hard local problem before anything else on the list matters.

**Recommendation: choose A explicitly, for now, and say so in the product strategy.** The evidence —
subscription tiers already priced and enforced three layers deep (`plan-tiers.ts`,
`plan-server.ts`, and the `0187` database trigger), a 35-module business OS, zero payment code —
says the company has already chosen A in practice. Writing it down stops the roadmap from being
pulled toward marketplace features (escrow, disputes, ranking, take-rate) that Path A does not need.

**Cost: a decision, not a sprint.**

---

## 4. Recruit merchants into one existing sector. Build no new engine.

**This is the recommendation that matters most and it is the least technical.**

Twelve of seventeen sectors have **zero active stores**: automotive, hospitality, beauty, farm,
fitness, realEstate, contractors, sportsCourts, events, petCare, pharmacy, education. Each has a
purpose-built engine sitting behind it. The stay engine (migration 0191) and the ticketing engine
(0193) both shipped and both have zero rows in their primary tables. `event_ticket_types` is empty.
`store_memberships` is empty. `store_portfolio` is empty. `craft_requests` is empty.

**Matjar's constraint has never been that it lacks an engine. It is that it has never recruited a
merchant into one.**

**Pick `beauty` or `fitness`, recruit 5–10 real merchants, and fix only what those merchants
break.** Both reasons are concrete:

- Both have a complete live engine today — beauty routes to the appointment surface with a provider
  roster; fitness has memberships and classes with real tables and a real storefront section.
- **Neither needs new architecture to start.** Compare `hospitality` (needs rate plans), `events`
  (needs attendee identity and check-in), `automotive` (needs enumerated brands and range filters) —
  each of which turns a go-to-market phase into a build phase.
- Both are high-frequency and dense in Lebanon, so the 22-booking base can move visibly.

The prior audit already scoped what each would need on contact
(`docs/matjar-vertical-platform/04_VERTICAL_CAPABILITY_MATRIX.csv` — beauty: "staff pick + packages
+ deposit + before/after"; fitness: "real membership ledger"). That file has a `build_trigger`
column, and the instinct behind it is exactly right. **Honour it. Build on contact, not in
anticipation.**

**Success criterion: 5 merchants live in one sector, taking bookings from customers they did not
already have.** Not "the engine works" — it already does.

**Cost: 4–6 weeks, mostly not engineering.** If this fails, nothing else in this document helps, and
that is the honest read.

---

## 5. What I would explicitly NOT do

### 5.1 I would not build a dynamic sector-definition engine or an admin schema builder

**This is the strongest negative recommendation in the audit.**

A UI that lets an admin define a new sector without a deploy must answer, at runtime: which React
component renders this sector's transaction surface (a booking panel, a stay search, a ticket picker
and a cart are four different components with four different data contracts); which tables it reads;
what its RLS looks like; and how its labels are translated in a 4,203-line Arabic-first dictionary
whose type is *inferred from the JSON* (`get-dictionary.ts:13`), so a runtime-defined field has no
key at all.

Each is a subsystem. Together they are a low-code platform — a different company.

**The codebase already contains the correct guard and it is holding.**
`src/components/business-type-manager.tsx:16-18` restricts new business types to
`SUPPORTED_SLUGS = new Set(categoryKeys)`, with the reasoning written out in full. **Live check:
`business_types` holds 17 rows and 0 unsupported slugs.**

**Do this instead, cheaply:** move that guard into the database as a `check` constraint on
`business_types.slug` — today it is client-side only and the anon key is committed at
`src/lib/supabase/config.ts:11`, so a REST call bypasses it. Then replace the silent `?? "retail"`
fallback (`merchant/[storeId]/layout.tsx:88`, `page.tsx:110`, `modules/page.tsx:50`) with a visible
error, because a pharmacy quietly rendering as a retail shop is worse than a crash.

**The bright line: an admin may edit what a sector is called and whether it is offered. An admin may
not define what a sector does.** That is where Matjar already sits. Adding an 18th sector today is
one object literal in `sectors.ts` plus dictionary keys — an afternoon. That is not the bottleneck.

### 5.2 I would not rebuild discovery yet

Server-side filtering, attribute facets, availability-aware search and PostGIS are all correctly
diagnosed and all premature.

`/explore` currently fetches up to `STORE_FETCH_LIMIT = 200` stores and filters them in the browser
(`src/lib/data/stores.ts:68, :84`; `explore-client.tsx:189-204`). With **13 active stores**, that is
not merely adequate — it is faster than a server round trip and supports richer interaction. The cap
is 15× current supply, and the code already names its own trigger (`stores.ts:67`).

PostGIS is the sharpest case: distance is client-side Haversine (`geo.ts:3-18`) and there is no
spatial extension in the database at all — but **only 3 stores have coordinates**. Adding a
geography column and a GiST index to search three points is infrastructure theatre. Fix the data
entry first (add the map pin to the onboarding checklist that already exists), then revisit.

**Gate this on ~60 active stores, or on a real query the current model cannot answer.** The full
design, when the gate opens, is in `27_IMPLEMENTATION_ARCHITECTURE.md` §5.

### 5.3 I would not merge `products` and `listings` — but I would write down the boundary today

Matjar has two independent models of "a listing": store-scoped `products`, and the `listings` table
behind `/market` (which is, notably, the **only** surface on the platform with price-range filters,
pagination, and saved-search alerts). The two sectors whose entire category is listing-first —
`realEstate` and `automotive` — use the first and would be better served by the second.

A migration would touch the busiest table in the schema **for two sectors with zero active stores
between them.** Not now.

But write the boundary down in an ADR this week, because every feature built before the decision
deepens the duplication. The honest line available today: `products` = things a store sells
repeatedly; `listings` = a specific individual item sold once, which expires.

### 5.4 I would not merge the two module taxonomies

`OsModuleKey` (35 merchant work screens) and `FeatureModuleKey` (23 customer-visible capabilities)
model genuinely different things. Merging forces `accounting`, `hr` and `payroll` to become
customer-visible capabilities, which they are not.

**But there is a real bug to fix, cheaply.** The merchant sidebar builds nav from
`sector.modules[group]` (`merchant/[storeId]/layout.tsx:163-170`) and never reads `store_modules`, so
switching a module off removes it from the storefront and leaves it in the dashboard.
`resolveStoreModules` has exactly one call site in the entire codebase
(`store/[id]/page.tsx:209`). The fix is a nullable `feature?: FeatureModuleKey` edge on
`OS_MODULE_META` and one added clause in the sidebar filter — ~2 hours, detailed at
`27_IMPLEMENTATION_ARCHITECTURE.md` §2.2.

### 5.5 I would not build learned ranking, escrow, two-sided reviews, rate plans, courier tracking, listing dedupe, or an AI layer

All correctly diagnosed as gaps in `02_COMPETITOR_BENCHMARK.md`. All measured against 65 products,
7 orders, 5 reviews, 9 listings and 169 monthly page views. Recency ordering is currently
indistinguishable from perfect ranking.

Two nuances worth keeping:
- **`bought_together`** (`src/lib/data/related.ts:41-59`) is already real co-purchase collaborative
  filtering. If a recommendation layer is ever wanted, extend that rather than importing anything.
- **One ranking item *is* worth fixing now regardless of volume:** paid placement is applied at four
  independent points (`stores.ts:90, :221`, `market.ts:230`, `0098:89`) and is **disclosed nowhere**.
  That is a trust issue at 13 stores as much as at 13,000, and it costs a badge.

### 5.6 I would not redesign anything

Nothing in this audit found the visual or interaction layer to be the constraint. The i18n work in
particular is better than most bilingual codebases — 4,203 lines per dictionary with **zero missing
keys in either direction**, types inferred from the JSON so a missing key is a compile error, a
hand-rolled duplicate-key test written because `JSON.parse` silently drops duplicates, and a
`dictSlice()` helper created after the home page once serialised 212 KB of dictionary into the HTML.

---

## 6. Ranked summary

| # | Recommendation | Cost | Ships value at 13 stores? |
|---|---|---|---|
| 1 | Close `get_push_subs` anon grant + scope `store-assets` INSERT + sweep the revoke class | ~1 day | Yes — security is volume-independent |
| 2 | Unplug the analytics: wire `log_search` fully, build `admin_search_gaps`, resolve `content_reports` and `checkout_intents` | ~3 days | Yes — it is the only path to knowing anything |
| 3 | Decide Path A (SaaS) vs Path B (take rate) explicitly and write it down | a decision | Yes — it removes half the roadmap |
| 4 | Recruit 5–10 merchants into **one** existing zero-store sector; build only what they break | 4–6 weeks | **This is the whole game** |
| 5 | Phase 0 correctness: sidebar honours `store_modules`; `business_types.slug` constraint; loud sector fallback; fold the 4 sector Sets into `SectorConfig`; label paid placement | ~2 days | Yes |
| 6 | Merchant reply to reviews (verified genuinely missing — no column, no code) | ~1–2 days | Yes |
| 7 | Merchant activation: cost price (0 of 65 products have one) and map pin (3 of 13 stores) into the existing onboarding checklist | ~3 days | Yes — it makes the accounting and location modules real |
| 8 | Make native push actually deliver, or stop asking for the permission | ~3 days | Yes |
| 9 | Fix `attributes.ts`: enumerate automotive `brand`, add range operators | ~3 days | Only pre-emptively — but data created before the fix has to be cleaned after |
| — | Server-side discovery, facets, availability search | 4–6 weeks | **Gated on ~60 active stores** |
| — | PostGIS, learned ranking, escrow, rate plans, dedupe, schema builder | — | **No** |

Items 1, 2, 5, 6, 7 total roughly **two weeks** and are almost entirely finishing work on things
already built. Item 4 is not an engineering project at all — which is the finding.

---

## 7. Closing note on what this codebase is

The brief that commissioned this audit assumed a generic store builder. What is actually here is a
17-sector configuration-driven business OS with 259 applied migrations, 436 database functions, 289
RLS policies, a module registry with dependency resolution, a pure and unit-tested transaction-surface
resolver, an exclusion-constraint-backed booking engine, three-layer plan enforcement, a WebAuthn
staff time clock, and a hosted-hybrid native shell — built to a standard of internal documentation
that is well above average. Several migration files explain not just what they change but which
prior bug forced the change, and `store-experience.ts` opens with a paragraph explaining why
hardcoded slug lists were the wrong answer.

That quality is why the recommendations above are mostly "stop building". The engineering is not the
problem. **13 active stores, 25 registered users, 7 orders and 169 monthly page views are the
problem**, and no amount of further architecture addresses it.
