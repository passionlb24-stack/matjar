# 01 — Current Architecture

Audit date: 2026-08-17. Branch: `feat/store-approval-loop`. Working tree clean at audit start; no
application code, schema, or migration was modified.

All production database figures in this document were read live from Supabase project
`wesihatopiznatsyfxer` with read-only `SELECT`s during this audit.

---

## 1. Stack

| Layer | Choice | Evidence |
|---|---|---|
| Framework | Next.js **16.3.0**, App Router | `package.json` |
| Runtime | React **19.2.4** | `package.json` |
| Styling | Tailwind **v4** (`@tailwindcss/postcss`) | `package.json`, `postcss.config.mjs` |
| Backend | Supabase — Postgres + RLS + Storage + Auth | `src/lib/supabase/*` |
| Hosting | Vercel | `vercel.json`, `@vercel/analytics` |
| Native shell | **Capacitor 8** (android, ios, push, geolocation, camera, share, splash, status-bar) | `package.json`, `capacitor.config.ts` |
| Maps | Leaflet 1.9 (no vendor SDK) | `package.json` |
| Passkeys | `@simplewebauthn` v13 | `package.json` |
| Tests | Vitest 4 — 19 test files | `src/lib/__tests__/`, `src/i18n/__tests__/` |

**Notable absences, verified:** no ORM (Supabase client only), no state library, no component
library, no form library, no analytics SDK beyond `@vercel/analytics`, no payment SDK of any kind,
no `next-pwa` / `workbox`, no PostGIS or any spatial extension.

**Middleware note.** Next.js 16 renamed middleware; the file is `src/proxy.ts`, not
`src/middleware.ts`. It is 28 lines and does exactly two things — enforce a locale prefix
(`proxy.ts:12-19`) and refresh the Supabase session for its side-effect (`proxy.ts:21`, →
`src/lib/supabase/proxy-session.ts:28`). **It performs no route protection.** Its matcher excludes
`/api` (`proxy.ts:27`), so API routes read cookies directly.

---

## 2. Routing

- **141** `page.tsx` route files, **8** `route.ts` handlers.
- Locale segment `[lang]` wraps everything; three route groups: `(site)` public marketplace,
  `(dashboard)` merchant + admin, `(auth)`.
- Route handlers: `api/clock/punch`, `api/clock/register`, `api/push/broadcast`, `api/push/hook`,
  `s/[code]` (short-link), `(auth)/callback`, `(auth)/auth/confirm`, `[lang]/download/[itemId]`.

**Public surfaces** (`src/app/[lang]/(site)/`) — 40+ top-level routes. Beyond the core
store/product/explore/search set, there are **five effectively independent marketplaces**:
`/market` (Sunday Market classifieds), `/crafts` (trades directory), `/freelance` (gigs),
`/jobs`, `/wholesale`. Each has its own tables, its own browse RPC, and its own filter model.
See §5 — this is the most significant unresolved architectural question in the codebase.

**Merchant surfaces** (`merchant/[storeId]/`) — 40 module directories plus `layout.tsx`,
`page.tsx`, `loading.tsx`. **Admin surfaces** — 22 sections under `admin/`.

---

## 3. The sector registry — how it actually works

This is the heart of the platform and it is real. Four files participate, and **they use four
different keying schemes.** Understanding that fragmentation is the prerequisite for §27.

### 3.1 `src/lib/catalog.ts` (349 lines) — identity and navigation

- `categoryKeys` — **17 sectors**, a `const` tuple (`catalog.ts:4-22`): `food, retail, services,
  healthcare, realEstate, automotive, beauty, fitness, sportsCourts, education, events, hospitality,
  pharmacy, petCare, professional, contractors, farm`. `CategoryKey` derives from it
  (`catalog.ts:24`), which makes every `Record<CategoryKey, …>` in the codebase exhaustive at compile
  time.
- `groupKeys` — **9 buyer-facing groups** (`catalog.ts:57-67`) with `categoryGroup`
  mapping 17 → 9 (`catalog.ts:71-89`). The reasoning is in the comment at `catalog.ts:52-56`:
  sectors stay granular for merchant experience; groups exist so discovery shows ~9 tabs, not 17.
- `RegionKey` — 5 Lebanese regions (`catalog.ts:96-109`).
- Also contains **8 hardcoded demo stores and 17 sets of sample products** (`catalog.ts:148-349`),
  gated off by `SHOW_DEMO_STORES = false` (`catalog.ts:257`) but still shipped and still used as a
  fallback path in the live store page (`store/[id]/page.tsx:84-102`).

### 3.2 `src/lib/modules.ts` (38 lines) — the legacy transaction-kind map

`categoryModule: Record<CategoryKey, StoreModule>` (`modules.ts:18-38`) assigns each sector a
`kind: "commerce" | "booking"`, an `itemsKey` noun (menu/products/services/listings), an `addKey`,
and `simplifiedItem`. Still load-bearing: consumed by `getSector()` (`sectors.ts:411`),
`resolveStoreExperience` (`store-experience.ts:116`) and `isOrderSurface`
(`store-experience.ts:106`).

### 3.3 `src/lib/modules-catalog.ts` (116 lines) — the feature-module catalog

`FeatureModuleKey` — **23 capability keys** in five families (`modules-catalog.ts:16-43`):
commerce (`catalog, menu, orders, inventory, delivery, pos`), scheduling (`appointments, timeslot,
classes, reservations, memberships, rentals`), services/listings (`requests, listings, portfolio,
courses`), cross-cutting (`team, reviews, verifications, location, marketing, messaging, media`).

`MODULE_CATALOG` (`:59-86`) gives each a `tier: "free" | "pro"` and optional `dependsOn` /
`conflictsWith`. `withDependencies()` (`:105-116`) closes a desired set over its dependencies so the
resolved set is always internally consistent — enabling `delivery` implies `orders`; `rentals`
implies `timeslot`.

**`conflictsWith` is declared in the type (`:55`) and never populated or enforced.** No entry in
`MODULE_CATALOG` sets it, and no function reads it. A store can therefore have `menu` and `listings`
on simultaneously.

### 3.4 `src/lib/sectors.ts` (457 lines) — the registry proper

Two independent taxonomies live in this one file:

**(a) `OsModuleKey` — 35 dashboard modules** (`sectors.ts:60-95`), with `OS_MODULE_META`
(`:104-153`) carrying per-module `Icon`, URL `path`, `ownerOnly`, a staff `perm`
(orders/bookings/products), and `minPlan` (pro/business). `OsGroupKey` groups them into
`daily | people | money | store` (`:97`).

**(b) `SectorConfig`** (`:155-169`) — per sector: `Icon`, `heroTint`, `iconTint`, `customersNoun`
(customers/patients/clients/leads), `features: FeatureModuleKey[]`, and
`modules: Record<OsGroupKey, OsModuleKey[]>`.

`sectorConfig` (`:182-407`) fills all 17. Shared arrays `MONEY`, `MONEY_WITH_SUPPLIERS`, `STORE`
(`:171-180`) avoid repetition, with the reasoning stated in-line ("Real estate has no goods
suppliers").

Resolvers exported:
- `getSector(category)` (`:410-412`) — merges `sectorConfig` with the legacy `categoryModule`.
- `sectorDefaultModules(category)` (`:415-417`) — the sector's `features` bundle.
- `sectorPrimarySetup(category)` (`:425-433`) — the first entity a sector must create before it can
  transact. Only `hospitality` → `accommodation_units` and `events` → `event_ticket_types` differ
  from the generic "add products" nudge.
- `sectorHasTeam(category)` (`:438-440`) — derived from `features.includes("team")`, not a
  hardcoded list. Good pattern.
- **`resolveStoreModules(category, overrides)`** (`:445-457`) — sector defaults, overlaid with
  per-store toggles, closed over dependencies.

### 3.5 `src/lib/store-experience.ts` (189 lines) — the transaction-surface resolver

A pure, unit-tested function (`src/lib/__tests__/store-experience.test.ts`) that decides which
transaction surface a storefront shows. Its header comment (`:5-17`) records exactly why it exists:
the store page previously used hardcoded slug lists that disagreed with the sector registry, so
"sectors that declared an `appointments`/`requests` module never surfaced it, and sectors whose
correct engine does not exist yet … exposed a wrong flow (a hotel booked by the hour, a car sold via
cart)."

It returns a `StoreExperience` of 9 booleans/enums (`:66-95`) from four hardcoded sector sets:
`DIRECTORY_ONLY_SECTORS` = {realEstate, automotive} (`:35-38`), `STAY_SECTORS` = {hospitality}
(`:41-43`), `TICKET_SECTORS` = {events} (`:46-48`), `LEAD_SECTORS` = {realEstate, automotive}
(`:54-57`).

**This supersedes the prior audit's capability matrix.** `docs/matjar-vertical-platform/
04_VERTICAL_CAPABILITY_MATRIX.csv` lists hospitality and events as `DIRECTORY-ONLY`; they are no
longer — the stay engine (migration 0191) and ticket engine (0193) shipped and the resolver now
routes them. Only realEstate and automotive remain directory-only.

### 3.6 Where the registry is consumed

| Consumer | Reads | File:line |
|---|---|---|
| Public store page | `resolveStoreModules` + `resolveStoreExperience` + `sectorHasTeam` | `store/[id]/page.tsx:209, 272, 493` |
| Merchant sidebar / tab bar | `getSector().modules` — **not** `resolveStoreModules` | `merchant/[storeId]/layout.tsx:88, 163-170` |
| Merchant OS home | `getSector()`, `sectorPrimarySetup` | `merchant/[storeId]/page.tsx:110-111` |
| Module manager page | `sectorDefaultModules` only | `merchant/[storeId]/modules/page.tsx:71` |
| Product create/edit forms | `sectorHasTeam`, `categoryAttributes` | `product-form.tsx:83`, `product-edit-form.tsx:145` |
| Product detail page | `isOrderSurface` | `store-experience.ts:104` |

### 3.7 Discipline check: how much `if (category === …)` is actually left?

- **20** raw `category === "…"` comparisons in the entire `src/` tree, spread over 11 files. The
  heaviest are `store/[id]/page.tsx` (4, at lines 498-504 and 699 — the section-title noun and the
  healthcare info block) and `product-edit-form.tsx` (3).
- **7** exhaustive `Record<CategoryKey, …>` tables — `category-icon.tsx:25`, `attributes.ts:23`,
  `catalog.ts:71`, `catalog.ts:266`, `modules.ts:18`, `note-hint.ts:24`, `sectors.ts:182`.
- **5** `Set<CategoryKey>` membership lists — four in `store-experience.ts`, one in
  `store-products.tsx:117` (`GRID_CATEGORIES`).

**Verdict: the discipline is genuinely good.** 20 scattered conditionals across a 141-route app is
low, and the `Record<CategoryKey, …>` form is compile-time exhaustive — adding an 18th sector
produces type errors at every table that must be extended, which is the correct failure mode. The
problem is not scattering; it is that **12 per-sector lookup structures live in 8 files**, so there
is no single place to read to know what a sector is. See `27_IMPLEMENTATION_ARCHITECTURE.md`.

---

## 4. The two module systems do not reconcile — the most consequential finding in this file

There are two module taxonomies, and only one of them respects per-store configuration.

| | `FeatureModuleKey` (23) | `OsModuleKey` (35) |
|---|---|---|
| Defined in | `modules-catalog.ts:16-43` | `sectors.ts:60-95` |
| Resolved by | `resolveStoreModules()` | direct array read of `sector.modules[group]` |
| Honours `store_modules` overrides | **Yes** | **No** |
| Drives | public storefront sections | merchant sidebar, phone tab bar, OS home |
| Toggleable by merchant | Yes (subtractively — see below) | No |

**Consequence:** a merchant who switches `classes` off in the module manager removes the classes
section from their public page, but the **Classes** item stays in their dashboard sidebar, because
`merchant/[storeId]/layout.tsx:163-170` builds nav from `sector.modules[group]` and never reads
`store_modules`. `resolveStoreModules` has exactly **one** call site in the entire codebase
(`store/[id]/page.tsx:209`).

**The module manager is subtractive only.** `merchant/[storeId]/modules/page.tsx:71` builds its list
from `sectorDefaultModules(category)`, so a store may only turn **off** modules its sector already
grants. It cannot turn **on** a module outside its sector bundle. The in-line comment
(`modules/page.tsx:68-70`) states the intent — "not the whole 23-module catalog — that would offer a
clothing shop courses" — which is a defensible product decision, but it means the `store_modules`
table can never express "this particular gym also runs a café".

**Adoption, live:** `store_modules` holds **7 rows across 2 distinct stores**. Of 13 active stores,
11 have never touched a module toggle. The per-store configuration layer is, empirically, unused.

---

## 5. Two unreconciled models of "a listing"

Matjar contains two independent implementations of the same concept and they do not share a table,
a search path, or a filter model.

**Model A — store-scoped `products`.** Every offering belongs to a store (`products.store_id`),
carries `item_kind` (product/service), variants, add-ons, stock, and a free-form `attributes` jsonb
typed by `src/lib/attributes.ts`. Discovery goes store-first.

**Model B — the `listings` table** (`0036_sunday_market.sql`), powering `/market`. It has its own
taxonomy (`market_categories`, `market_regions`, `market_cities`), its own seller model (a `seller_id`
*or* a `store_id`), and — uniquely in the codebase — **real filtering: price range, pagination via
`.range()`, and four sort orders** (`src/lib/data/market.ts:178-245`). It also has the only
saved-search/alert system on the platform (`0048_saved_searches.sql`).

`/market` is the closest thing Matjar has to a listing-first marketplace, and the `realEstate` and
`automotive` sectors — the two sectors whose entire category is listing-first — do not use it. They
use Model A in directory-only mode. This is the single biggest structural duplication in the
product.

The same duplication repeats at smaller scale: `/crafts` has `craft_providers` +
`craft_services` + `craft_requests` + `browse_crafts` — a parallel service-provider marketplace
alongside the `services` and `contractors` sectors, which use `products` + `service_requests`.

---

## 6. Data architecture

**Live production, read during this audit:**

| Metric | Value |
|---|---|
| Applied migrations (`supabase_migrations.schema_migrations`) | **259** |
| Public tables | **119** |
| Public functions | **436** |
| RLS policies | **289** |
| Public tables **without** RLS | **0** |

**Repo/prod reconciliation.** The repo holds **267** numbered migration files
(`0001`–`0271`, with `0152` and `0201`–`0203` absent). Production records 259 applied entries. The
head matches exactly — the newest applied entry is `tell_the_merchant_what_happened_to_their_store`,
which is repo file `0271_tell_the_merchant_what_happened_to_their_store.sql`. The 8-entry delta is
historical bookkeeping (early files applied as a squashed baseline), **not schema drift**. The
current schema is in sync.

**Schema phases** (from migration filenames, in order): foundation (`0001-0011`) → marketplace
fill-out (`0012-0034`) → Sunday Market + geo + guest checkout (`0035-0056`) → growth features
(`0057-0067`) → Business OS: CRM/inventory/POS/ledger (`0068-0090`) → analytics &
denormalisation (`0091-0122`) → **the sector/module system (`0123-0141`)** → granular admin roles and
permission-scoped RLS (`0142-0159`) → booking engine v2 and the sector engines: leads 0190,
accommodation 0191, ticketing 0193 (`0160-0200`) → money correctness: cost/margin, ledgers, tax
invoices, FX (`0204-0233`) → digital goods, crafts, accounting (`0234-0253`) → HR, attendance,
payroll, WebAuthn clock-in (`0254-0271`).

**Table inventory: 124 tables created across all migrations, 119 live in `public`.** Full list in the
migration set; the notable analytics/event tables are `search_logs`, `store_visits`,
`content_reports`, `hub_tool_events`, `order_events`, `order_status_events`, `lead_activities`,
`stock_movements`, `automation_runs`, `audit_logs`, `clock_attempts`, `enrolment_attempts`.

### 6.1 Instrumentation is built and unread

This is a correction and a refinement of the audit brief's premise that "no general
product-analytics event table exists". A view-tracking table **does** exist:

`store_visits` — columns `store_id, product_id, path, source, visitor, device, city, created_at`
(read live). Written by `<TrackVisit>` (`src/components/track-visit.tsx`) via the
`track_store_visit` RPC, mounted on **both** the store page (`store/[id]/page.tsx:513`) **and** the
product page (`product/[id]/page.tsx:219`). It de-dupes per session, skips `navigator.webdriver`
bots, and uses a random localStorage id rather than any PII.

So **store-profile and product-view tracking do exist**. What genuinely does not exist:
impression tracking (a result appearing in a list), and any funnel event past a view — no
add-to-cart, no checkout-start, no filter-applied, no booking-started.

Live volume: **169 store_visits in 30 days** — 152 store views (30 unique visitors, 27 stores) and
17 product views (8 unique visitors, 9 stores).

**Three instrumentation tables are write-only or wholly unused:**

| Table | State |
|---|---|
| `search_logs` | **0 rows.** `log_search` accepts six sections (`0216:86`) but is called from exactly one place — `explore-client.tsx:144`, `"products"` only. The `/search` page does not log; nor do market, jobs, freelance, wholesale or crafts. The `admin_search_gaps` report the migration calls "the single most actionable thing this platform can know" (`0216:11-14`) has no reader in `src/`. |
| `hub_tool_events` | Written once from `src/`; **nothing reads it.** |
| `content_reports` | Created `0216:165` with policies; **zero `src/` references**, no `report_content` RPC found. Fully unused. |
| `saved_searches` | **0 rows.** Wired end-to-end for `/market` only (`0048`). |
| `lead_activities`, `fx_rates`, `checkout_intents` | Written by RPC/trigger; no read path found in `src/`. |

### 6.2 Live business volume

| Entity | Rows | Distinct stores |
|---|---|---|
| Stores | 33 total — **13 `active`**, 20 `suspended` | — |
| Registered profiles | **25** | — |
| Products | 65 | 19 |
| Orders | **7** (all within the last 30 days) | 3 |
| Bookings | 22 | 6 |
| Listings | 9 | — |
| Reviews | 5 | — |
| Messages | 13 | — |
| Follows | 10 | — |
| `store_modules` overrides | 7 | 2 |
| `search_logs`, `saved_searches` | **0** | — |

> **One discrepancy with the audit brief, stated honestly.** The brief gives 11 active stores; I read
> **13** rows with `status = 'active'`. I cannot reconcile without knowing the exact predicate used —
> the current branch is `feat/store-approval-loop`, so approval semantics may be in flux, or two
> stores may have been activated between the two readings. Nothing in this audit's conclusions turns
> on 11 vs 13.

**Sector distribution of active stores** (`business_types.slug`, live):

| Sector | Active | Total |
|---|---|---|
| retail | 7 | 10 |
| services | 2 | 4 |
| healthcare | 2 | 3 |
| food | 1 | 4 |
| professional | 1 | 1 |
| **automotive, hospitality, beauty, farm, fitness, realEstate, contractors, sportsCourts, events, petCare, pharmacy, education** | **0** | 1–2 each |

**12 of 17 sectors have zero active stores.** This single fact governs the roadmap.

### 6.3 Business-type ↔ code coupling, and the schema-builder risk

A store's sector comes from the database: `stores.business_type_id → business_types.slug`, cast
straight to `CategoryKey` with a `?? "retail"` fallback (`merchant/[storeId]/layout.tsx:88`,
`page.tsx:110`, `modules/page.tsx:50`). A `business_types` row whose slug is not in `categoryKeys`
would make `sectorConfig[category]` `undefined` and crash both the storefront and the module page.

**This risk is already recognised and guarded in code.** `src/components/business-type-manager.tsx:16-18`
declares `SUPPORTED_SLUGS = new Set(categoryKeys)` with the reasoning written out, and
`:71-88` blocks creating a type with an unsupported slug (existing types keep their slug).

**Live check: `business_types` holds 17 rows and 0 unsupported slugs.** The guard is holding. Note
it is a **client-side guard only** — there is no `check` constraint on `business_types.slug` and no
FK to any enum. An admin with the anon key and a REST call could still insert an arbitrary slug.

### 6.4 Booking correctness

Overlap prevention is in the database, not the application: `0174_booking_engine.sql` uses
`btree_gist` exclusion constraints (lines 15, 75, 82) and `0191_accommodation_engine.sql` the same
(lines 8, 74). Order arithmetic is duplicated deliberately — `src/lib/order-math.ts` mirrors the
authoritative server RPCs (`place_customer_order` / `place_guest_order`) and
`src/lib/__tests__/order-math.test.ts` pins the two together so a silent divergence fails CI
(`order-math.ts:1-7`). This is a good pattern.

---

## 7. Auth and authorisation

**Authentication.** Supabase email/password + Google OAuth. PKCE exchange at
`(auth)/callback/route.ts:19-26` with an open-redirect guard (`:17`); `auth/confirm/route.ts`
handles both `token_hash` and `code` flows with a stricter guard that also rejects protocol-relative
`//` (`:39-42`).

**Passkeys are not user login.** `@simplewebauthn` is used only for the staff time-clock —
`api/clock/register` (enrolment, single-use 10-minute code) and `api/clock/punch`
(`userVerification: "required"`, no `allowCredentials` list so devices are not enumerable,
`punch/route.ts:51-56`). RP ID is derived per-request from forwarded headers
(`src/lib/webauthn.ts:11-21`), so it works on localhost, preview and production without an env var.

**There is no shared user guard.** `auth.getUser()` is called ad-hoc in **128 places across 126
files**, each repeating `if (!user) redirect(\`/${lang}/login\`)`. The only guard helper is
`src/lib/admin-guard.ts` — `requireAdminSection(section, lang)` (`:11-34`), explicitly documented as
defence-in-depth over RLS (`:9-10`). Store access goes through an inline
`supabase.rpc("can_manage_store", …)` (e.g. `merchant/[storeId]/layout.tsx:54-57`).
`getSession()` appears exactly once, in a client component for a realtime token
(`header-bells.tsx:81`) — correctly, it is never used for a server-side trust decision.

**Authorisation is three-tiered**, and the tiers are the security model:

| Helper | Defined | Semantics |
|---|---|---|
| `is_store_owner(uuid)` | `0232:52` | strictly the owner |
| `staff_can(uuid, text)` | `0024:10` | owner **or** staff holding that named permission |
| `can_manage_store(uuid)` | `0018:30` | owner **or** **any** `store_staff` row — reads no permission |
| `admin_can(text)` | `0149:12` | super_admin **or** holds that admin section |
| `is_platform_admin()` | `0149:22` | super_admin **or** holds ≥1 section |

`0232_staff_permissions_mean_something.sql` is the key document here. It records that
`can_manage_store` gated roughly 60 policies, so "a clerk hired with nothing but *products* ticked
passed every one of them. The permission checkboxes were decoration wherever that function stood."
It fixed three things — added `staff_can(…, 'orders')` to `order_items`, moved five config tables
(`store_verifications`, `store_verification_docs`, `store_modules`, `store_checkout_fields`,
`store_delivery_zones`) to owner-only, and **deliberately left the remaining ~55 policies on
`can_manage_store`**, on the stated grounds that narrowing all sixty at once would lock out working
merchants (`0232:25-28`). **That residual is a known, documented, accepted risk — not an oversight.**

---

## 8. RLS posture

**289 live policies, 119 tables, 0 tables without RLS.** Across the migration files: 123
`enable row level security` statements and 399 `create policy` statements (later ones replace
earlier ones).

**Patterns:**
- **Public read** is status-gated with no role clause, so `anon` passes:
  `stores_select_public … using (status = 'active' and deleted_at is null)` (`0003:87`);
  `products_select_public` on the same shape (`0005:29`).
- **Merchant write** began as inline `exists (select 1 from stores s where … s.owner_id = auth.uid())`
  (`0003:95`, `0005:51`) and was progressively replaced by the helper functions above.
- **Admin** began as `is_super_admin()` (`0004:41`) and became section-scoped `admin_can('…')` from
  `0149` onward.

**SECURITY DEFINER hygiene is unusually clean.** Of 315 function headers in the migrations, **286 are
SECURITY DEFINER and all 286 set `search_path`.** Five set a non-empty `public` rather than `''`
(`0001:38`, `0007:7`, `0128:38`, `0130:42`, `0132:22`) — low risk (no dynamic SQL) but inconsistent
with the 281-function `search_path = ''` convention.

**The real risk is in GRANTs, not search_path.** 19 SECURITY DEFINER functions are executable by
`anon`. Two warrant attention:

1. **`get_push_subs(uuid, text)`** (`0049:31`) returns push endpoints and keys for an arbitrary
   `p_uid`, protected only by a shared secret compared in SQL, and is granted to `anon`.
   `0196_emergency_hardening.sql:7` names this as finding **MJ-A02 and explicitly declines to fix
   it**. No later migration revokes it. **Verified live during this audit: `pg_proc.proacl` shows
   EXECUTE granted to `anon` in production. This is an open hole today, not merely an in-repo one.**
2. **`clock_store_context(text)`** is anon-granted and resolves a store from a short code;
   `api/clock/punch/route.ts:41` calls it with the **service role** before any authentication. That
   is intentional (the WebAuthn assertion is verified after) but means an unauthenticated POST
   reaches a service-role RPC.

**A whole class of revoke bug is documented in-repo.**
`0258_actually_revoke_anon_from_hr_functions.sql` records that `revoke all … from public` does
**not** remove Supabase's direct `anon` grant, so the revokes in `0248`, `0254` and `0256` were
no-ops and six HR functions including `employee_clock` were anon-callable. That same pattern may
exist elsewhere and has not been swept.

**`store_modules` policy note.** `0127:22` created `store_modules_public_read … using (true)` —
unconditionally public, deliberately, so the storefront can resolve modules. `0232:73` later replaced
the *manage* policy with owner-only, but left the read policy untouched. Any client can therefore
enumerate every store's module configuration including the `config` jsonb. That jsonb defaults to
`{}` and I found no migration that writes structured secrets into it, but there is **no `module_key`
check constraint** — the valid key set lives only in `src/lib/sectors.ts`.

---

## 9. Storage

**Two buckets.**

**`store-assets`** (`0008_storage_bucket.sql:2-4`) — public. No SELECT policy, deliberately
(`0008:6-7`): a public bucket serves by URL anyway, and a broad SELECT would let clients list every
filename. `0077_security_hardening.sql:11-16` capped it at 5 MB, images only.

> **Open issue.** `store_assets_auth_insert` (`0008:10`) is `with check (bucket_id = 'store-assets')`
> and nothing else — **any authenticated user may upload anywhere in the bucket**, including into
> another store's folder. `0077:9-10` records that per-user path scoping was deferred because upload
> paths key on `storeId` not uid. **Still deferred at `0271`.** Update/delete *are* owner-scoped
> (`0008:15, :20`), so existing objects cannot be overwritten — only new ones planted.

**`digital-goods`** (`0234:55-57`) — private, 100 MB. Write and manage policies require
`is_store_owner((split_part(name,'/',1))::uuid)`. **No read policy at all, by design** — reads go
through `[lang]/download/[itemId]/route.ts`, which is the model to copy: entitlement is decided by
`digital_download_grant()` running **as the caller** (`:38-41`), and only then does the service-role
client mint a 300-second signed URL (`:64-68`).

**A past storage/RLS interaction is worth recording.**
`0225_move_verification_docs_out_of_public_read.sql` fixed a case where
`store_verifications.doc_url` pointed at the *public* bucket while the row was readable via
`status='verified'` — so a single REST call harvested every verified store's scanned commercial
registration (owner name, ID number, home address). Fixed by splitting `store_verification_docs`
into its own table with only a manage policy. The store page still carries the defensive comment
explaining why `doc_url` is not selected (`store/[id]/page.tsx:179-183`).

**No server-side image transformation.** No `.transform()` anywhere. Downscaling is client-side
(`image-upload.tsx:30`, `maxDim = 1600`), and `next/image` — whitelisted for the Supabase public
storage host at `next.config.ts:40-48` — is the only transform in the pipeline.

---

## 10. Service-role key containment

`src/lib/supabase/admin.ts:1` is `import "server-only"`, so an accidental client import is a build
error. The key is read from `SUPABASE_SERVICE_ROLE_KEY` — **not** `NEXT_PUBLIC_`-prefixed, therefore
never inlined into the client bundle. Four consumers, all server-side: `download/[itemId]/route.ts:57`,
`api/clock/punch/route.ts:37`, `api/clock/register/route.ts:31`, and `merchant/[storeId]/hr/page.tsx:154`
— which reads only `!!process.env.SUPABASE_SERVICE_ROLE_KEY` as a boolean, leaking "is it
configured", not the value. **No path from the key to client code was found.**

Note that `src/lib/supabase/config.ts:7,11` hardcodes the project URL and the **publishable** anon
key as env-overridable defaults. That is not a secret, but it does mean the production project id
is committed.

---

## 11. Capacitor + PWA duality

**The native app is a hosted-hybrid wrapper, not a static export.** `capacitor.config.ts:11` sets
`serverUrl = process.env.CAP_SERVER_URL || "https://matjarlb.com"` and `:19-25` points the WebView
at it. `webDir: "native-shell"` (`:17`) is only the pre-load/offline fallback — it contains exactly
one file, an 81-line static Arabic RTL splash card. `MOBILE_APP.md:3-8` states it plainly: "There is
**one codebase** — the web app *is* the app." Native rebuilds are needed only for plugin/config
changes.

`AndroidManifest.xml:26-32` declares `autoVerify` App Links for `matjarlb.com`; permissions are
INTERNET, POST_NOTIFICATIONS, COARSE+FINE_LOCATION, CAMERA (`:49-56`).

**Native capabilities, all behind a lazy `isNative()` check** (`src/lib/native.ts:6-14`):
geolocation with web fallback (`:23-45`), camera returning a `File` so it rides the existing web
upload path (`:60-85`), share with a three-level fallback native → Web Share → clipboard (`:92-121`).
Splash, status bar, Android back button, deep links and push registration live in
`src/components/native-bridge.tsx`, mounted once at `[lang]/layout.tsx:117`. All 9 `@capacitor/*`
imports are dynamic.

**PWA:** a generated manifest (`src/app/manifest.ts` — `start_url: "/ar"`, `dir: "rtl"`,
`display: "standalone"`) and a **hand-written 133-line service worker** (`public/sw.js`) — no
`next-pwa`, no `workbox`. It is network-first for navigations with an `/offline.html` fallback
(`:68-77`), cache-first only for `/_next/static/` and images/fonts (`:80-99`), and carries an
explicit `NEVER_CACHE` list of private prefixes (`:38-49`).

**Push is two parallel systems and only one delivers.**

- **Web Push (VAPID) — works end to end.** DB trigger chain documented at `0049:3-4`:
  `notifications INSERT → push_on_notification → notify_push (pg_net POST) → /api/push/hook`, with an
  `x-push-secret` header. The hook 503s without its keys (`:9-13`) and sends per subscription
  (`:42-54`). Dead subscriptions are swallowed but **never deleted** (`:50-52`).
- **Native FCM/APNs — collects tokens, sends nothing.** `native-bridge.tsx:75-78` stores the device
  token via `register_device_token` into `device_push_tokens` (`0067`). Grepping `src/` and
  `supabase/` for `fcm|device_push_tokens|list_user_device_tokens` returns **exactly two files** —
  the bridge and the migration. There is no FCM sender. `MOBILE_APP.md:60-64` lists building one as
  outstanding work.

So a native app user who grants notification permission receives nothing unless they also hold a web
push subscription. `/api/push/broadcast` sidesteps this by writing in-app notifications
(`admin_broadcast_notify`) and letting the 0049 bridge fan out — its header comment (`:3-9`) records
that it used to write to `push_subscriptions` directly, "a table with zero rows in practice", so
broadcasts reached nobody.

---

## 12. i18n

Two locales, `ar` (default) and `en` (`src/i18n/config.ts:4,8`), with `localeDirection`
`{ ar: "rtl", en: "ltr" }` (`:11-14`) applied at `[lang]/layout.tsx:84`.

Both dictionaries are **4,203 lines, 78 top-level keys, 3,890 leaf strings, with zero keys missing
in either direction** — genuine parity. `get-dictionary.ts` is `import "server-only"` and infers
`type Dictionary` from the JSON itself (`:13`), so a missing key is a compile error rather than a
runtime `undefined`.

Two engineering details worth recording because both encode a real past incident:
- `src/lib/dict-slice.ts:4-7` — the home page once serialised the ~175 KB dictionary three times into
  the HTML: "212KB of inline script, 62% of the document." `dictSlice()` now builds genuinely smaller
  objects at server→client boundaries.
- `src/i18n/__tests__/no-duplicate-keys.test.ts:7-10` — a hand-rolled raw-text scanner, because
  `JSON.parse` silently keeps the last duplicate key. Two real bugs are cited.

RTL is handled with logical Tailwind utilities (`rtl:rotate-180`, `ltr:-translate-x-full
rtl:translate-x-full`) across dozens of components rather than a separate stylesheet. Hardcoded
`dir="rtl"` appears in only two admin content editors.

---

## 13. Plan tiers

`src/lib/plan-tiers.ts` defines three paid tiers plus a free floor: **basic $10/mo** (30 products,
1 staff), **pro $25/mo** (200 products, 3 staff), **business $65/mo** (unlimited, 10 staff), with
annual and promo pricing and a `PROMO_END` that auto-expires (`:19`). `hasPlan()` is a rank
comparison (`:84-89`), so Business satisfies a Pro requirement. `effectivePlan()` takes the max of
paid plan and trial-Pro (`:100-108`) — the comment (`:91-99`) records the bug it fixes: three call
sites computed `onTrial ? "pro" : plan`, silently downgrading a Business store during its trial.

**Enforcement is three layers deep, not client-only:**
1. Server-component redirects on every Pro page (`pos/page.tsx:55`, `coupons/page.tsx:42`,
   `reports/page.tsx:175`, `staff/page.tsx:42`, and five more), reading `getStorePlan` from
   `src/lib/plan-server.ts` (`import "server-only"`).
2. A database trigger — `0187_tier_product_limit.sql:4-24`, `enforce_free_product_limit()`,
   SECURITY DEFINER, recomputing the plan server-side including trial, raising errcode `53400`. This
   holds even if every UI check is bypassed.
3. Sidebar padlocks (`merchant/[storeId]/layout.tsx:157`) — cosmetic affordance only.

This is the right shape.

---

## 14. Repository coverage manifest

What I read, what I found, and — explicitly — what I did not open.

### Read in full

| Path | Lines | Finding |
|---|---|---|
| `src/lib/sectors.ts` | 457 | Sector registry; 17 sectors, 35 OS modules, 4 group keys, 5 resolvers. §3.4 |
| `src/lib/modules-catalog.ts` | 116 | 23 feature modules, tiers, `withDependencies`. `conflictsWith` declared and unused. §3.3 |
| `src/lib/catalog.ts` | 349 | 17 `CategoryKey`, 9 `GroupKey`, 5 regions, + 200 lines of dormant demo data. §3.1 |
| `src/lib/store-experience.ts` | 189 | Transaction-surface resolver; 4 hardcoded sector Sets. Supersedes the prior capability matrix. §3.5 |
| `src/lib/modules.ts` | 38 | Legacy commerce/booking kind map, still load-bearing. §3.2 |
| `src/lib/attributes.ts` | 147 | Controlled attribute vocabulary for 4 of 17 sectors. §6, and `02` §F1/H1 |
| `src/app/[lang]/(site)/store/[id]/page.tsx` | 726 | The module-driven storefront. 3 parallel query waves; 4 residual `category ===` checks |
| `src/app/[lang]/(dashboard)/merchant/[storeId]/layout.tsx` | ~280 | Sidebar/tab-bar built from `sector.modules` — **ignores `store_modules`**. §4 |
| `src/app/[lang]/(dashboard)/merchant/[storeId]/modules/page.tsx` | ~105 | Module manager; subtractive-only. §4 |
| `src/app/[lang]/(dashboard)/admin/business-types/page.tsx` + `business-type-manager.tsx` | ~140 read | Slug guard against `categoryKeys`; client-side only. §6.3 |
| `src/components/track-visit.tsx` | 70 | View tracking on store **and** product pages. §6.1 |
| `src/lib/order-math.ts` (head) | 87 | Client mirror of the authoritative server RPC, pinned by tests. §6.4 |
| `src/proxy.ts` | 28 | Locale + session refresh only; no route protection. §1 |
| `capacitor.config.ts`, `MOBILE_APP.md`, `native-shell/index.html` | — | Hosted-hybrid wrapper confirmed. §11 |
| `package.json`, `next.config.ts`, `AGENTS.md` | — | Stack. §1 |
| `docs/matjar-vertical-platform/04_VERTICAL_CAPABILITY_MATRIX.csv` | 18 rows | Prior audit's per-sector status; now partly superseded |

### Read via delegated sweep (evidence cited by the sweep, spot-checked by me)

| Area | Coverage | Key finding |
|---|---|---|
| Search & discovery — `explore/`, `search/`, `map/`, `src/lib/data/*`, `search-state.ts`, `admin-search.ts` | full read of ~12 files | No relevance ranking anywhere; 200-row client-side cap; attributes not queryable across stores; `log_search` wired at 1 of 6 sections |
| DB & security — all 267 migrations (headers + targeted full reads), `src/lib/supabase/*` | header-parsed, ~15 read fully | 286/286 definer functions set `search_path`; 19 anon-granted; MJ-A02 open; storage insert unscoped |
| Native/PWA/auth/i18n/plans — `capacitor.config.ts`, `native.ts`, `native-bridge.tsx`, `sw.js`, `manifest.ts`, push routes, `(auth)/*`, `src/i18n/*`, `plan-tiers.ts`, `plan.ts` | full read of ~20 files | Native push collects and never sends; 128 ad-hoc `getUser()` calls; dictionary parity clean; plan gating 3 layers deep |

### Verified directly against production

`supabase_migrations.schema_migrations`, `information_schema.tables`, `pg_proc`, `pg_policies`,
`pg_tables.rowsecurity`, `stores`, `business_types`, `store_modules`, `profiles`, `products`,
`orders`, `bookings`, `store_visits`, `search_logs`, `saved_searches`, `reviews`, `follows`,
`messages`. All read-only.

### NOT inspected — state plainly

| Area | Why it matters |
|---|---|
| **~130 of 141 `page.tsx` routes** | I opened 8 in full. Route-level bugs outside store/merchant/modules/explore/search/map are out of scope of this audit. |
| **~250 of 266 components** | I read ~14. Component-level correctness is unaudited. |
| **The 5 side marketplaces in depth** — `/market`, `/crafts`, `/freelance`, `/jobs`, `/wholesale` | I established that they exist, have their own tables and RPCs, and duplicate the listing concept (§5). I did **not** audit their internals, RLS, or UX. |
| **The automations engine** (`src/components/automation/*`, `automations`, `automation_runs`) | Entirely uninspected. |
| **Accounting, HR, payroll, attendance modules** (migrations `0204-0271`, ~10 merchant routes) | Read only at migration-header level. `0258`'s admission that its own rate limiter is broken suggests this area warrants its own audit. |
| **`android/app/**`, `ios/App/**`** | Top level only. I did **not** confirm whether `google-services.json` exists, nor check the iOS Associated Domains / `apple-app-site-association` setup. |
| **The 4,203-line dictionaries' content** | Verified programmatically for key parity and duplicate keys. Translation quality unreviewed. |
| **`supabase/tests/`, `.github/`** | Not opened. CI coverage unknown. |
| **`/icon.png`** | Referenced by `manifest.ts:21-23` and `sw.js:10,105`; not present in `public/`. May be Next's `src/app/icon.png` file convention. **Unverified** — if absent, manifest icons 404 and the SW precache silently no-ops. |
| **Live `pg_policies` bodies** | I counted 289 policies but did not read their `USING` clauses. `0232` says "a handful" of the ~55 policies still on `can_manage_store` may need narrowing; identifying which requires reading live policy text, not migration files. |
| **The 19 anon-granted SECURITY DEFINER functions beyond the two named in §8.** I verified `get_push_subs` and `clock_store_context` live; the other 17 were identified by migration-text scan and their live grants were not individually confirmed. |
| **Runtime behaviour** — I ran no dev server, no build, no test suite, and no browser session. |
