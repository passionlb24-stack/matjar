# 00 — Executive Summary

**Matjar marketplace audit, Checkpoint 0.** Read-only. No application code, schema or migration was
modified. Audit date 2026-08-17, branch `feat/store-approval-loop`. Production database
(`wesihatopiznatsyfxer`) was read live with read-only queries.

---

## 1. The premise this audit was commissioned on is wrong

The brief assumes Matjar is "a generic store builder where every business gets the same page". **It
is not, and it has not been for some time.**

Matjar is a **17-sector, configuration-driven commerce platform**. Each business type is data, not
code: a sector declares which capabilities its customers see, which screens its merchant works in,
what it calls its customers, and how it transacts. Adding a sector is one object literal plus
dictionary keys — not a new code path.

The evidence, all verified:

- **`src/lib/sectors.ts` (457 lines) is a real sector registry.** 17 sectors, each with an icon,
  hero tint, customers noun (customers/patients/clients/leads), a bundle of 23 possible feature
  modules, and 35 merchant OS modules grouped into daily / people / money / store.
- **`src/lib/modules-catalog.ts` is a real capability catalog** with tiers and dependency closure —
  `withDependencies()` guarantees that enabling `delivery` pulls in `orders`, so a resolved module
  set can never be internally inconsistent.
- **`src/lib/store-experience.ts` is a pure, unit-tested resolver** that derives which transaction
  surface a storefront shows from its enabled modules rather than from its slug. Its header comment
  records exactly why it exists: hardcoded slug lists previously caused "a hotel booked by the hour,
  a car sold via cart".
- **The public store page is genuinely module-driven.** `store/[id]/page.tsx:209` resolves the
  store's modules and then conditionally renders timeslot booking, memberships, classes, portfolio,
  courses, reservations, location and verifications from that set.
- **The merchant dashboard has 40 module routes** — stays, units, tickets, courses, classes,
  doctors, memberships, portfolio, leads, requests, kitchen, POS, branches, resources, HR,
  attendance, accounting, automations, campaigns, suppliers, inventory and more.
- **The database backs all of it:** 259 applied migrations, 119 public tables, 436 functions, 289 RLS
  policies, and **zero tables without RLS**.

Only **20 raw `category === "…"` comparisons** exist in the entire `src/` tree across 141 routes and
266 components. The per-sector discipline is genuinely good.

**Almost nothing in this audit recommends building the sector engine, because it exists.** The real
constraints are adoption and depth. Where something is genuinely missing, the following sections say
so precisely.

---

## 2. What is actually true: the platform has outrun its market

Read live from production during this audit:

| | |
|---|---|
| Active stores | **13** (20 suspended, 33 total) |
| Sectors with ≥1 active store | **5 of 17** — retail 7, services 2, healthcare 2, food 1, professional 1 |
| Sectors with **zero** active stores | **12** |
| Registered user profiles | **25** |
| Products | 65 (across 19 stores) — **0 of 65 have a cost price** |
| Orders, all time | **7** (3 stores; all within the last 30 days) |
| Bookings | 22 (6 stores) |
| Page views, 30 days | **169** — 30 unique visitors |
| `search_logs` / `saved_searches` | **0 rows each** |
| Stores with any module override | **2 of 13** |
| Stores with map coordinates | **3** |

Against that: 259 migrations, 436 functions, 141 routes, 266 components, a booking engine, a stay
engine, a ticketing engine, a lead engine, POS, inventory, accounting, HR, payroll, WebAuthn staff
clock-in, automations, and a Capacitor 8 native shell.

**The stay engine (migration 0191) and ticketing engine (0193) both shipped and both have zero rows
in their primary tables.** `store_memberships`, `store_portfolio`, `event_ticket_types`,
`event_tickets` and `craft_requests` are all empty.

> *A note on the brief's figure of 11 active stores: I read 13 rows with `status = 'active'`. I
> cannot reconcile the difference without knowing the exact predicate — the current branch is
> `feat/store-approval-loop`, so approval semantics may be in flux. Nothing here turns on 11 vs 13.*

---

## 3. The seven findings that matter

### F1 — Matjar builds transaction engines and never exposes them to discovery

This is one architectural gap with five symptoms, and it is the most important technical finding.

| Capability | Where it lives | Where discovery needs it |
|---|---|---|
| Booking availability | one store's booking panel | "who is free tomorrow at 6pm near me" |
| Stay availability (`search_stay` takes `p_store_id`) | one hotel's page | "any chalet, North, 14–16 Aug, 4 guests" |
| Delivery zones (fees, minimums, ETAs) | one store's checkout | "who delivers to my address" |
| Structured attributes (bedrooms, mileage, gearbox) | one store's product grid, client-side, exact-match | "3-bedroom in Beirut under $200k" |
| Insurance / specialties | one clinic's info block | "dermatologist who takes my plan" |

`/explore` accepts exactly three parameters — `q`, `region`, `group` (`explore/page.tsx:32`) — and
does no server-side filtering at all: it fetches up to 200 stores and filters them in the browser.
There is no relevance ranking anywhere (`searchStores` has **no `.order()` clause at all**), no
full-text search, no spatial extension in the database, and no facet counts.

**But see F7 — at 13 stores this is not yet a problem.**

### F2 — The two module systems do not reconcile

`FeatureModuleKey` (23 customer-visible capabilities) drives the public storefront and honours
per-store `store_modules` overrides. `OsModuleKey` (35 merchant work screens) drives the dashboard
sidebar and **ignores them entirely** (`merchant/[storeId]/layout.tsx:163-170`).

A merchant who switches a module off sees it vanish from their storefront and stay in their
dashboard. `resolveStoreModules` has exactly **one** call site in the entire codebase.

The module manager is also **subtractive only** — a store can turn off modules its sector grants but
never turn on anything else (`modules/page.tsx:71`). Live adoption: **7 override rows across 2 of 13
stores.** Eleven merchants have never opened the page.

**Fix:** a nullable `feature?: FeatureModuleKey` edge on `OS_MODULE_META` and one clause in the
sidebar filter. ~2 hours. Do **not** merge the taxonomies — they model different things.

### F3 — Two live security holes that two prior hardening passes consciously deferred

- **`get_push_subs`** returns push endpoints and keys for an arbitrary user id, protected only by a
  shared secret compared in SQL, granted to `anon`. `0196_emergency_hardening.sql:7` named it MJ-A02
  and **explicitly declined to fix it**. **Verified live: `pg_proc.proacl` shows EXECUTE granted to
  `anon` in production today.**
- **`store-assets` bucket INSERT is unscoped** — any authenticated user may write into any store's
  folder (`0008:10`). `0077:9-10` deferred the path scoping. Still deferred.
- **A whole class of revoke bug is documented and unswept.** `0258` records that
  `revoke … from public` does **not** remove Supabase's `anon` grant, so six HR functions including
  `employee_clock` were anon-callable. Nobody has checked the rest.

Set against a strong baseline: **286 of 286 SECURITY DEFINER functions set `search_path`**, and 0 of
119 tables lack RLS.

### F4 — The analytics layer is built and never read

- **`search_logs`: 0 rows.** `log_search` accepts six sections; it is called from **one** place
  (`explore-client.tsx:144`), for products only. `/search`, `/market`, `/jobs`, `/freelance` and
  `/wholesale` do not log.
- **`admin_search_gaps` has no reader** — the zero-result demand report that `0216:11-14` calls "the
  single most actionable thing this platform can know".
- **`hub_tool_events`** is write-only. **`content_reports`** is created with policies and has zero
  references in `src/`. **`checkout_intents`** is written and never read.

> **A correction to the brief.** View tracking *does* exist: `store_visits` carries a `product_id`
> and `<TrackVisit>` is mounted on **both** the store page and the product page — 169 views in 30
> days, session-deduped, bot-filtered, no PII. What genuinely does not exist is any event past a view
> (add-to-cart, checkout-start, filter-applied) and any impression tracking.

### F5 — Sector logic is fragmented across four files with four keying schemes

`catalog.ts` (CategoryKey/GroupKey) → `modules.ts` (commerce/booking kind) → `sectors.ts` (features
+ OS modules) → `store-experience.ts` (four hardcoded sector `Set`s). Twelve per-sector lookup
structures across eight files.

The scattering is not severe (all `Record<CategoryKey, …>` tables are compile-time exhaustive, so
adding an 18th sector fails loudly at every table that must be extended — the correct failure mode).
The problem is that there is no single place to read to know what a sector *is*. Folding the four
`Set`s into a `SectorConfig.transactionModel` field takes about an hour and is covered by existing
tests.

### F6 — Two unreconciled models of "a listing"

Store-scoped `products` versus the `listings` table behind `/market` — which is the **only** surface
on the platform with price-range filters, pagination and saved-search alerts. The two sectors whose
entire category is listing-first (`realEstate`, `automotive`) use the first and would be better
served by the second. The same duplication repeats with `/crafts` alongside the `services` sector.

**Do not migrate** — both listing-first sectors have zero active stores. **Do write the boundary down
this week**, because every feature built before the decision deepens the duplication.

### F7 — Twelve of seventeen sectors have zero active stores

This governs everything. Every "missing" capability in the competitor benchmark — ranking, escrow,
rate plans, courier tracking, dedupe, attribute facets — is a correct diagnosis of a problem Matjar
does not yet have.

**Matjar's constraint has never been that it lacks an engine. It is that it has never recruited a
merchant into one.**

---

## 4. What we recommend

Full detail in `30_FINAL_RECOMMENDATIONS.md`; sequencing in `28_IMPLEMENTATION_ROADMAP.md`.

| # | Do | Cost |
|---|---|---|
| 1 | Close the two deferred security holes and sweep the revoke class | ~1 day |
| 2 | Unplug the analytics — wire `log_search` fully, build the search-gaps report, resolve the three dead tables | ~3 days |
| 3 | **Decide explicitly: SaaS (Path A) or take-rate marketplace (Path B).** The codebase has already chosen A in practice — three priced tiers enforced three layers deep, a 35-module business OS, zero payment code. Writing it down removes half the roadmap | a decision |
| 4 | **Recruit 5–10 merchants into ONE existing zero-store sector** (`beauty` or `fitness` — both have complete live engines and need no new architecture). Build only what those merchants break | 4–6 weeks |
| 5 | Correctness: sidebar honours `store_modules`; DB `check` constraint on `business_types.slug`; loud sector fallback; fold the four sector `Set`s into the registry; label paid placement | ~2 days |
| 6 | Merchant reply to reviews — verified genuinely missing (no column, no code) | ~1–2 days |
| 7 | Merchant activation: cost price and map pin into the existing onboarding checklist | ~3 days |

**What we would explicitly NOT do:**

- **No dynamic sector-definition engine or admin schema builder.** It would need a runtime component
  selector, a table selector, an RLS policy builder and a parallel translation store — a low-code
  platform, a different company. The correct guard **already exists** in
  `business-type-manager.tsx:16-18` and is holding (17 business types, 0 unsupported slugs). Move it
  into the database as a `check` constraint and keep the bright line: an admin may edit what a sector
  is *called*, never what it *does*.
- **No discovery rebuild yet.** Gate it on ~60 active stores. At 13, client-side filtering over a
  200-row window is faster than a server round trip.
- **No PostGIS.** Only 3 stores have coordinates. Fix data entry first.
- **No learned ranking, escrow, rate plans, courier tracking, listing dedupe, or AI layer.** Measured
  against 65 products, 7 orders, 5 reviews and 169 monthly page views.
- **No merge of the two module taxonomies, and no `products`/`listings` migration.**
- **No redesign.** The i18n work in particular — 4,203 lines per dictionary, zero missing keys either
  direction, types inferred so a missing key is a compile error — is better than most bilingual
  codebases.

**One exception worth fixing regardless of volume:** paid placement is applied at four independent
points and disclosed nowhere. That is a trust problem at 13 stores as much as at 13,000, and it
costs a badge.

---

## 5. The honest read

The engineering here is well above average. Migration files explain not just what they change but
which prior bug forced the change. `store-experience.ts` opens with a paragraph on why hardcoded slug
lists were the wrong answer. `order-math.ts` deliberately mirrors the authoritative server RPC and
pins the two together with tests so a silent divergence fails CI. Booking overlap is prevented by
`btree_gist` exclusion constraints in the database rather than by application checks.

That quality is precisely why most of these recommendations are "stop building". **13 active stores,
25 registered users, 7 orders and 169 monthly page views are the problem, and no further architecture
addresses it.**

---

## Document index

| File | Contents |
|---|---|
| `00_EXECUTIVE_SUMMARY.md` | This document |
| `01_CURRENT_ARCHITECTURE.md` | Stack, routing, sector registry, data architecture, auth, RLS, storage, Capacitor+PWA duality, and a **repository coverage manifest** stating explicitly what was and was not inspected |
| `02_COMPETITOR_BENCHMARK.md` | 27 product principles across 8 marketplace categories; whether Matjar has each, with evidence, and the gap. Principles only — no branding, colours, layouts or copy, and no live inspection of any competitor |
| `27_IMPLEMENTATION_ARCHITECTURE.md` | How to extend the existing resolver pattern; where configuration belongs (code vs DB vs admin UI); why an unconstrained admin schema builder is the wrong direction |
| `28_IMPLEMENTATION_ROADMAP.md` | Phased and gated against 13 stores and 7 orders, including the phases and proposals **rejected** and why |
| `30_FINAL_RECOMMENDATIONS.md` | Ranked recommendations and the explicit do-not-do list |
