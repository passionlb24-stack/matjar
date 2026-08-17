# 27 — Implementation Architecture

How to evolve what already exists. This document assumes `01_CURRENT_ARCHITECTURE.md` has been read;
it does not restate the findings, it acts on them.

**The framing that matters:** Matjar does not need a sector engine. It has one, it works, and it is
better than the brief assumed. What it needs is (a) to finish consolidating the engine it has, and
(b) to lift the marketplace query layer up to where the sector engine already sits. Nothing below
proposes a rewrite.

---

## 1. The resolver pattern that already exists — name it and standardise on it

Three functions in the codebase already implement the right pattern, and they should be recognised as
the platform's architectural spine rather than as three separate utilities.

```
sectorDefaultModules(category)              → FeatureModuleKey[]      sectors.ts:415
      ↓  overlaid with per-store overrides
resolveStoreModules(category, overrides)    → Set<FeatureModuleKey>   sectors.ts:445
      ↓  closed over dependencies via withDependencies()              modules-catalog.ts:105
resolveStoreExperience({category, modules}) → StoreExperience         store-experience.ts:111
      ↓  9 booleans/enums the UI renders from
```

Three properties make this correct, and they are the properties any extension must preserve:

1. **Pure.** `resolveStoreExperience` performs no I/O, which is why it is unit-tested
   (`src/lib/__tests__/store-experience.test.ts`) and why the same decision can be reused by the
   store page, the product page, and any future surface.
2. **Derived, not declared twice.** `sectorHasTeam()` reads `features.includes("team")`
   (`sectors.ts:438-440`) rather than keeping a second list of team sectors. This is the single
   most important habit in the file — every derived predicate should be written this way.
3. **Closed over dependencies.** `withDependencies()` guarantees the resolved set is internally
   consistent, so no caller ever has to remember that `delivery` implies `orders`.

**Rule for all future work: a new sector-varying behaviour is a new field on `SectorConfig` or a new
`FeatureModuleKey`, resolved through these functions. It is never a new `if (category === …)` and
never a new `Set<CategoryKey>` in a component.**

---

## 2. The three concrete defects to fix in the existing engine

These are consolidation work, not new architecture. They are ordered by cost-to-fix ascending and
they should be done before anything in §3 or §4.

### 2.1 Collapse the four hardcoded sector Sets in `store-experience.ts` into the registry

`DIRECTORY_ONLY_SECTORS`, `STAY_SECTORS`, `TICKET_SECTORS` and `LEAD_SECTORS`
(`store-experience.ts:35-57`) are the last place where sector behaviour is declared outside
`sectorConfig`. They exist for an honest reason — they encode *engine readiness*, which is a
platform fact, not a merchant choice — but they are keyed by slug, which is exactly the coupling
the file's own header comment warns against.

**Proposal.** Add two fields to `SectorConfig`:

```ts
type SectorConfig = {
  // …existing fields…
  /** How this sector's customers transact. Derived from which engine is live,
   *  not from what the sector "is". */
  transactionModel: "order" | "appointment" | "stay" | "ticket" | "lead" | "directory";
  /** Inquiry kinds this sector's lead form offers (first = default).
   *  Empty = no lead form. Replaces leadKinds(). */
  leadKinds?: string[];
};
```

Then `resolveStoreExperience` switches on `sectorConfig[category].transactionModel` instead of four
Set lookups, and `leadKinds()` (`store-experience.ts:60-64`, currently two `if` statements) becomes a
field read.

**Why this is worth doing.** Directory-only status is a *temporary* state that ends when an engine
ships. Today, promoting `realEstate` out of directory-only means editing a `Set` in a file whose name
does not contain the word "sector". After this change, everything a sector is lives in one object
literal in `sectors.ts`, and the go-live decision is a one-word diff on the line that describes the
sector.

**Cost:** ~1 hour plus test updates. The existing test file already covers the behaviour, so this is
a safe refactor with a real safety net.

### 2.2 Make the merchant dashboard honour `store_modules`

This is the correctness bug from `01` §4. `merchant/[storeId]/layout.tsx:163-170` builds the sidebar
from `sector.modules[group]` and never reads `store_modules`, so switching a module off removes it
from the storefront but leaves it in the dashboard.

The obstacle is that the two taxonomies do not map: `OsModuleKey` has 35 keys, `FeatureModuleKey` has
23, and there is no relation between them. `memberships`, `classes`, `portfolio`, `courses`,
`verifications` and `pos` exist in both with the same name; `orders`/`bookings`/`items` are
`OsModuleKey` operational screens that correspond to feature modules under different names; and
`accounting`, `hr`, `suppliers`, `kitchen`, `automations`, `tasks`, `branches` have no feature-module
counterpart at all, because they are back-office concerns with no public surface.

**Proposal — do not merge the two taxonomies. Relate them.** Add one optional field to
`OS_MODULE_META`:

```ts
OS_MODULE_META: Record<OsModuleKey, {
  Icon, path, ownerOnly?, perm?, minPlan?,
  /** The feature module this screen manages. When that module is switched off
   *  for this store, hide this screen. Absent = back-office, always shown. */
  feature?: FeatureModuleKey;
}>
```

Then the sidebar filter becomes one added clause:

```ts
const enabled = resolveStoreModules(category, overrides);
const canSee = (key) => /* existing perm logic */
  && (!OS_MODULE_META[key].feature || enabled.has(OS_MODULE_META[key].feature));
```

**Why this shape rather than a merge.** The two taxonomies are genuinely different things: a feature
module is *a capability a customer can see*, an OS module is *a screen a merchant works in*. Merging
them would force `accounting` to become a customer-visible capability, which it is not. A nullable
edge between them expresses the real relationship and leaves the back-office alone.

**Cost:** ~2 hours. The layout already fetches the store row; adding a `store_modules` select to the
existing query costs one round trip that is already parallelisable.

### 2.3 Decide, explicitly, whether the module manager stays subtractive

Today a store can only switch **off** modules its sector grants (`modules/page.tsx:71`, building from
`sectorDefaultModules`). It cannot switch **on** anything else. The in-line reasoning — "that would
offer a clothing shop courses" — is sound as a default, but it makes the sector bundle a ceiling
rather than a starting point.

The live evidence says this is not urgent: **7 override rows across 2 of 13 active stores.** Eleven
merchants have never opened the page.

**Recommendation: leave it subtractive, and revisit only when a real merchant asks.** But add the
capability to the data model now, because it is free: `store_modules` already has `enabled boolean`
and `module_key text` with no constraint on the key, so an additive override already stores
correctly. Only the UI restricts it. When the first gym with a café appears, the change is a one-line
edit to which array the page maps over.

**What to do now: nothing but document it.** Add a comment at `modules/page.tsx:68` saying the
restriction is a UI policy, not a schema limit, so the next person does not conclude the data model
needs changing.

---

## 3. Where configuration should live: code, DB, or admin UI

This is the question the brief flags as risky, and Matjar has — mostly by accident — already arrived
at close to the right answer. The rule that emerges from the codebase is worth stating explicitly
so it can be applied deliberately going forward.

> **Configuration belongs in code when changing it changes what the software *does*. It belongs in
> the database when changing it changes what the software is *about*.**

Applied to Matjar:

| Concern | Correct home | Why | Current state |
|---|---|---|---|
| The set of sectors (`categoryKeys`) | **Code** | Each sector requires an icon, a tint, a module bundle, a customers noun and a transaction model. A row cannot supply an icon component or a render path. | ✅ `catalog.ts:4-22` |
| Feature modules and their dependencies | **Code** | Each module is a render path and a set of queries. A module with no code is a checkbox that does nothing. | ✅ `modules-catalog.ts` |
| Which modules a sector defaults to | **Code** | It is the sector's definition. | ✅ `sectors.ts:182-407` |
| Transaction model / engine readiness | **Code** | It is a statement about which engines are built. | ⚠️ In code, but in the wrong file — see §2.1 |
| Per-store module on/off | **DB** | Genuinely per-tenant, changes without a deploy. | ✅ `store_modules` |
| Sector display names, sort order, active flag | **DB** | Editorial copy and merchandising. Changing "Healthcare" to "Clinics & Labs" changes nothing about behaviour. | ✅ `business_types` |
| Attribute *vocabularies* (bedrooms, gearbox, fuel) | **Split — see §4** | | ⚠️ All in code (`attributes.ts`) |
| Regions, cities, market categories | **DB** | Pure taxonomy, expands constantly. | ✅ `market_regions/cities/categories`, `lb_areas` |
| Plan prices and limits | **Code** | Pricing changes are a commercial event that should ship with a deploy and a changelog. | ✅ `plan-tiers.ts` |
| Store theme, accent, layout, hours, announcement | **DB** | Per-tenant presentation. | ✅ `stores` + `resolveTheme` |

**The load-bearing invariant:** `business_types.slug` is a **foreign key into TypeScript**. It is the
single point where a database value selects a code path. Everything else in the table (`name_ar`,
`name_en`, `icon`, `sort_order`, `is_active`) is safely editorial.

---

## 4. The unconstrained admin schema builder — the risk, and why Matjar should not build one

The tempting next step, and the one the brief asks me to address, is an admin UI where a super-admin
defines new sectors and their fields without a deploy. **I recommend against it, and the codebase
already contains the correct guard.**

### 4.1 The guard that exists

`src/components/business-type-manager.tsx:16-18`:

```
// Sector behavior (transaction model, modules, fields, CTA) is code-keyed by
// slug. Creating a business type with a slug outside this set would resolve to
// no sector config and crash the public store + module pages. Until the dynamic
// sector-definitions engine exists (audit file 17), only these slugs are safe.
const SUPPORTED_SLUGS = new Set<string>(categoryKeys);
```

Enforced at `:71-88`: a **new** type must use a supported slug; an existing type keeps its slug.
**Live verification: `business_types` holds 17 rows and 0 unsupported slugs.** The guard is holding.

### 4.2 Why an unconstrained builder is the wrong direction

A schema builder that lets an admin define a new sector has to answer, without a deploy:

- Which React component renders this sector's transaction surface? A booking panel, a stay search, a
  ticket picker and a cart are four different components with four different data contracts. A row
  cannot select one that does not exist.
- Which tables does it read? `store_resources`, `accommodation_units`, `event_ticket_types` and
  `products` have different columns and different RLS. A new sector needs one of these or a new one.
- What does its RLS look like? Every table in this platform carries policies. A user-defined table
  built through a UI either inherits a generic policy (too broad — and this codebase already fixed
  one instance of exactly that, `0225_move_verification_docs_out_of_public_read.sql`, where a public
  bucket plus a permissive read policy exposed scanned ID documents), or requires a policy builder,
  which is a security product in its own right.
- How is it translated? Every label in this app is a typed key in a 4,203-line dictionary whose type
  is *inferred from the JSON* (`get-dictionary.ts:13`). A runtime-defined field has no dictionary
  key, so it is either untranslated or needs a parallel translation store — and the platform is
  Arabic-first with RTL.

Each of those is a large subsystem. Together they are a low-code platform, which is a different
company. **Matjar's actual constraint is that 12 of 17 existing sectors have zero active stores** —
building infrastructure to add an 18th sector without a deploy solves a problem that has never
occurred. Adding a sector today is one object literal in `sectors.ts` plus a handful of dictionary
keys, and it can be done in an afternoon. That is not the bottleneck.

### 4.3 What to harden instead

Three cheap changes, in priority order:

1. **Move the slug guard into the database.** Today it is client-side only
   (`business-type-manager.tsx`) — an admin with the anon key and a REST call bypasses it entirely,
   and the anon key is committed at `src/lib/supabase/config.ts:11`. Add a `check` constraint on
   `business_types.slug` listing the 17 valid values. When a sector is added, the migration and the
   `categoryKeys` change ship together, which is exactly the coupling you want to force.
2. **Make the `?? "retail"` fallback loud.** `merchant/[storeId]/layout.tsx:88`, `page.tsx:110` and
   `modules/page.tsx:50` all silently coerce an unknown slug to `retail`. A pharmacy quietly
   rendering as a retail shop is worse than an error, because nobody notices. Replace with an
   explicit lookup that logs and shows a "sector not configured" state.
3. **Add a `check` constraint on `store_modules.module_key`** — or at minimum, filter unknown keys in
   `resolveStoreModules`. `0127` created the table with no constraint; the valid set lives only in
   TypeScript, and the read policy is `using (true)` so anyone can enumerate it.

**The bright line to hold:** an admin may edit *what a sector is called and whether it is offered*.
An admin may not define *what a sector does*. That boundary is where Matjar already sits. Keep it.

---

## 5. The one place that does need new architecture: lifting the query layer

Everything above is consolidation. This section is the exception, and it is the recurring finding
from `02_COMPETITOR_BENCHMARK.md` §"Cross-cutting": **Matjar builds transaction engines and then does
not expose them to discovery.**

Concretely, five capabilities exist one level below where the marketplace needs them:

| Capability | Where it lives | Where discovery needs it |
|---|---|---|
| Availability (`bookings`, `provider_availability_rules`) | one store's booking panel | "who is free tomorrow at 6pm" |
| Stay availability (`search_stay`, `p_store_id`) | one hotel's page | "any chalet, North, 14–16 Aug, 4 guests" |
| Delivery zones (`store_delivery_zones`) | one store's checkout | "who delivers to my address" |
| Attributes (`attributes.ts` + `products.attributes`) | one store's product grid, exact-match, client-side | "3-bedroom in Beirut under $200k" |
| Insurance / specialties | one clinic's info block | "dermatologist who takes my plan" |

This is one architectural gap with five symptoms. **The fix is not five features.**

### 5.1 The shape of the fix

Introduce a single server-side, paginated **discovery query layer** — one RPC per entity family, not
one per sector — that takes a filter object and returns ranked, paginated results. Today `/explore`
does the opposite: it fetches up to `STORE_FETCH_LIMIT = 200` rows with no filters
(`src/lib/data/stores.ts:68, 84`) and filters them in the browser
(`explore-client.tsx:189-204`). The file's own comment already anticipates this
(`stores.ts:67`): *"Raise or move to server-side pagination / PostGIS nearest-search when store count
nears it."*

The critical design decision is **how filters are declared**, and the answer is already in the
codebase. `src/lib/attributes.ts` has exactly the right shape — typed fields, bilingual labels,
enumerated options, and a `filter?: boolean` flag marking which are buyer-facing
(`attributes.ts:16-17`). Extend that, do not replace it:

```ts
type AttrField = {
  key; ar; en; type; unit?; options?;
  filter?: boolean;
  /** How this field is queried. Absent = exact match (today's behaviour). */
  filterOp?: "eq" | "range" | "min" | "contains";
  /** Facet this field platform-wide, not just inside one store. */
  global?: boolean;
};
```

Then the discovery RPC reads the same declaration the merchant form reads. One vocabulary, two
consumers — which is the `sectorHasTeam` principle from §1 applied to attributes.

### 5.2 Two defects to fix in `attributes.ts` while doing this

Both are cheap and both are currently wrong:

- **`brand` and `model` are `type: "text"`** for automotive (`attributes.ts:72-73`). Free text means
  "BMW", "bmw" and "B.M.W" are three brands and no facet can ever be computed. Brand must be
  enumerated.
- **No range semantics anywhere.** `year`, `mileage`, `rooms`, `bathrooms` and `area` are numeric,
  and the filter implementation is exact string equality
  (`store-products.tsx:829-833`). A buyer cannot ask for "under 100,000 km" even inside one dealer's
  page. `rooms` carries `filter: true` and still cannot express "3 or more".

### 5.3 What NOT to do here

**Do not add PostGIS yet.** Distance is client-side Haversine over a 200-row window
(`src/lib/geo.ts:3-18`), which is genuinely wrong at scale — but only **3 of the active stores have
coordinates at all**. Adding a spatial extension, a geography column, and a GiST index to search
three points is infrastructure theatre. Fix the data-entry side first: make the map pin picker part
of store onboarding so coordinates exist. Revisit PostGIS when store count passes the 200-row cap,
which the code will tell you about because the cap is a named constant.

**Do not build learned ranking.** With 65 products across 19 stores, recency ordering is
indistinguishable from perfect ranking. See `28_IMPLEMENTATION_ROADMAP.md`.

**Do fix one ranking thing now, regardless of volume:** paid placement is applied at four independent
points (`stores.ts:90`, `stores.ts:221`, `market.ts:230`, `0098:89`) and is **not labelled in the
UI**. Undisclosed paid placement is a trust problem at any volume and a regulatory one in several
jurisdictions. It costs a badge.

---

## 6. Resolving the two listing models

`01` §5 records that Matjar has two independent implementations of "a listing": store-scoped
`products`, and the `listings` table behind `/market`. The `realEstate` and `automotive` sectors —
the two whose entire category is listing-first — use the first and would be better served by the
second, which is the only surface on the platform with price-range filters, pagination and
saved-search alerts.

I am **not** recommending a merge. A merge would be a large migration touching the busiest table in
the schema, for two sectors with **zero active stores between them**.

**Recommend instead: decide the boundary and write it down.** The honest distinction available today
is:

- `products` = *things a store sells repeatedly* — a menu item, a service, a room type, a course.
  Store-scoped, catalog-shaped, re-orderable.
- `listings` = *a specific individual item sold once* — this apartment, this car, this second-hand
  fridge. Item-scoped, expires, listing-shaped.

Under that boundary, a real-estate agency's inventory belongs in `listings` with the store as
`store_id` (which the table already supports), and the agency's store page becomes a filtered view
over its own listings. That is a smaller change than it sounds and it inherits price filters,
pagination and saved-search alerts for free.

**But do not build it until a real-estate merchant signs up.** Write the decision into
`src/lib/catalog.ts` or a short ADR now, so the next feature does not deepen the duplication.

---

## 7. Summary of proposed changes, sized

| # | Change | Size | Depends on | Do it when |
|---|---|---|---|---|
| 2.1 | Fold the 4 sector Sets into `SectorConfig.transactionModel` | ~1h | — | Now — pure consolidation, tested |
| 2.2 | `OS_MODULE_META.feature` edge; sidebar honours `store_modules` | ~2h | — | Now — it is a correctness bug |
| 2.3 | Comment that subtractive module manager is UI policy, not schema limit | 5m | — | Now |
| 4.3.1 | `check` constraint on `business_types.slug` | ~30m | — | Now — closes a real bypass |
| 4.3.2 | Replace silent `?? "retail"` with an explicit unconfigured-sector state | ~1h | — | Now |
| 4.3.3 | Constrain/filter `store_modules.module_key` | ~30m | — | Now |
| 5.2 | Enumerate automotive `brand`; add `filterOp` range semantics | ~3h | — | Before the first dealer signs up |
| 5.3 | Label paid placement in the UI | ~2h | — | Now — trust, not scale |
| 5.1 | Server-side paginated discovery RPC reading the attribute declaration | ~2–3 weeks | 5.2 | See roadmap Phase 3 |
| 6 | Write down the `products` vs `listings` boundary as an ADR | ~1h | — | Now. **Implement: not yet.** |

Everything in the "Now" rows totals well under two days and is either a correctness fix or a
guard-rail. Nothing in it is speculative, and none of it builds for scale that does not exist.
