# 08 — Vertical Search

Checkpoint-0 audit. Read-only. Every claim below is traced to a file, a line, a
migration number, or a `SELECT` run against the production Supabase project
`wesihatopiznatsyfxer` on 2026-08-17.

---

## 0. Measurement note

I re-counted production directly rather than trust any figure. What I found:

| Thing | Count (2026-08-17) | Query basis |
|---|---|---|
| Stores, all non-deleted | 33 | `stores where deleted_at is null` |
| Stores, active + non-deleted | **13** | `status='active'` |
| Stores with `lat`/`lng` | 5 | |
| Regions represented by active stores | **1** (`north`) | |
| Products, non-deleted | 60 | |
| Products publicly visible | 59 | `status='active' and is_available and not hidden_by_plan` |
| Sunday-Market listings | 9 total, 6 active | |
| `craft_providers` rows | **0** | |
| `accommodation_units` rows | 4 | |
| `search_logs` rows | **0** | |

The brief's ground-truth figures (11 stores / 65 products / 9 listings, all
`north`, few with coordinates) are the same picture; the small deltas are a
different snapshot date or a stricter visibility filter. Nothing in this
document turns on the difference. The shape is what matters: **one region, low
double-digit merchants, low double-digit-to-sixty offerings.**

Active stores by sector (`business_types.slug`), all `region='north'`:

| Sector | Active stores | Visible products |
|---|---|---|
| retail | 7 | 30 |
| healthcare | 2 | 6 |
| services | 2 | 2 |
| food | 1 | 3 |
| professional | 1 | 0 |
| **other 12 sectors** | **0** | **0** |

Twelve of the seventeen sectors in `src/lib/sectors.ts` have **zero** live
merchants. That single fact governs every recommendation in this file.

---

## 1. What search actually exists today

### 1.1 The RPC inventory (verified against `pg_proc` usage and migrations)

| RPC | Migration | Scope | Called from |
|---|---|---|---|
| `search_products_fuzzy(p_q text)` | `0114_search_products_fuzzy.sql` | Marketplace-wide product name search | `src/lib/data/search.ts:31`, `src/components/explore-client.tsx:131` |
| `search_store_ids_by_product(p_q text)` | `0113_search_stores_by_product.sql` | Store ids carrying a matching product | **no caller in `src/`** — superseded by `search_products_fuzzy`, which returns `store_id` |
| `search_trades(p_q text, p_limit int)` | `0237_crafts_search_and_browse.sql` | Taxonomy autocomplete for trades | `src/components/crafts/crafts-search.tsx:59` |
| `browse_crafts(...)` | `0237`, rewritten by `0240_browse_crafts_reads_providers.sql` | Craft-provider directory listing | `src/lib/data/crafts.ts` → `src/app/[lang]/(site)/crafts/[trade]/page.tsx` |
| `trade_match(p_text, p_q)` | `0237` | Word-start regex match over normalised Arabic | internal to the two above |
| `normalize_search(p_q)` | `0216_platform_instrumentation.sql:59` | Harakat-stripping + alef/ya/ta-marbuta folding | internal |
| `search_stay(p_store_id, p_check_in, p_check_out, p_guests)` | `0191_accommodation_engine.sql:114` | **Single-store** availability | `src/components/stay-search.tsx:63` |
| `log_search(p_q, p_section, p_results, p_region)` | `0216:71` | Writes `search_logs` | `src/components/explore-client.tsx:144` — **one call site in the whole app** |

### 1.2 The three surfaces

**A. `/[lang]/search` — the global results page.**
`src/app/[lang]/(site)/search/page.tsx` calls `searchAll()`
(`src/lib/data/search.ts:56`), which fans out to three queries in parallel:

- `searchStores()` — `src/lib/data/stores.ts:178` — a plain
  `.ilike("name", "%term%")` on `stores`, optional `region` equality, `limit 24`.
  Store **name only**. No description, no sector, no area, no product join.
- `searchProducts()` — the `search_products_fuzzy` RPC, `limit 30` hard-coded
  inside the SQL (`0114:64`).
- `getActiveListings()` — Sunday Market, filtered by `q` + `region`.

There is no sector dimension, no facet, no pagination, no relevance blending
across the three lists — they render as three stacked sections. And note
`robots.ts:39` disallows `/ar/search` and `/en/search`, so this page is
deliberately non-indexable.

**B. `/[lang]/explore` and `/[lang]/category/[slug]` — the browse surface.**
Both render `src/components/explore-client.tsx`. The server hands it the full
active-store list (`getStoresForListing()` → `fetchActiveStores`,
`src/lib/data/stores.ts:75-97`, `limit 200`, `unstable_cache` 60s). Store
matching is then done **in the browser** (`explore-client.tsx:189-204`) by
lowercase substring on `store.name`. In parallel the client calls
`search_products_fuzzy` directly (`explore-client.tsx:131`) after a 250 ms
debounce, renders the product hits as a "matching products" strip, and unions
the hit stores back into the store grid (`explore-client.tsx:118-124`).

**C. Two genuine verticals.**

*Crafts / trades* is the one properly designed vertical search on the platform,
and it is worth studying because the rest should copy it:

- `trades` (47 active rows) carries a `synonyms text[]` column
  (`0235_crafts_taxonomy_and_service_areas.sql:45`). `search_trades` matches
  the query against `name_ar`, `name_en` **and every synonym**, through
  `normalize_search`, anchored to a word start (`0237:31-40`). The migration
  comment explains exactly why word-start and not `%q%`: two Arabic letters
  mid-word matched eight unrelated trades.
- `lb_areas` (45 rows, a controlled area vocabulary one level below `region`).
- Selecting a suggestion routes to `/[lang]/crafts/[trade]` — a real, named,
  indexable page — instead of dumping the raw string into a result set
  (`crafts-search.tsx:78-88`).
- `browse_crafts` returns **finished cards** (trades, coverage, rating, cheapest
  price, works count) so a result row needs no follow-up query.

This is the right architecture. It currently returns nothing, because
`craft_providers` has **0 rows** — migration `0238` moved providers off `stores`
onto a standalone table and nobody has signed up. All 47 trade pages × 2 locales
are live and empty.

*Stays* is **not** a vertical search. `search_stay` takes `p_store_id` as its
first argument (`0191:115`) — it answers "which of *this hotel's* units are free
on these dates", from inside a store page. There is no marketplace-wide
"chalets in the north, 4 guests, next weekend" query anywhere in the codebase.
Four `accommodation_units` exist across the whole platform.

### 1.3 Correctness and performance defects found

1. **`search_products_fuzzy` is half-unindexed.** `0080_search_trgm_indexes.sql`
   created `products_name_trgm` on `name` only. The RPC also filters on
   `name_en ILIKE` and `similarity(name_en, …)` (`0114:42,46,59,61`). Verified
   against `pg_indexes`: there is **no trigram index on `products.name_en`**.
   Every English-name search is a sequential scan. Irrelevant at 60 products,
   a cliff at 60,000.
2. **`stores.region` is unindexed.** `searchStores()` filters by it
   (`stores.ts:193`), `browse_crafts` filters `craft_providers.region` (that one
   *is* indexed). Add `stores(region)` before regional filtering means anything.
3. **`search_store_ids_by_product` (0113) is dead code** — no caller in `src/`.
   Leave it; just do not build on it.
4. **`log_search` is wired into exactly one surface.** `/explore`'s product
   search calls it (`explore-client.tsx:144`). The main `/search` page — the one
   with a query string, the one a person actually lands on — **never calls it**.
   Consequence: `search_logs` has **0 rows**, and therefore
   `admin_search_gaps()` (`0216:286`) and the `search_gaps` block of
   `admin_attention_queue()` (`0216:261`) are permanently empty. Migration 0216's
   own comment says "every day without logging is a day of data that can never be
   recovered." That is currently happening.
5. **`log_search` cannot record a sector.** Its `section` check constraint
   (`0216:31`) allows only `stores|products|freelance|jobs|market|wholesale`. A
   sector-aware search cannot be logged without altering that constraint.
6. `search_products_fuzzy` has no `region`, `sector`, price or availability
   argument, and a hard `limit 30` with no offset. It cannot be the engine for
   any faceted vertical without a rewrite.

---

## 2. Per-sector search intent — all 17 sectors

"Intent" here means: what is the customer actually holding in their head when
they type, and what object must come back. Sectors differ far more in the
**shape of the answer** than in the words typed.

| # | Sector | What the customer types | Object that must come back | Search shape | Live merchants |
|---|---|---|---|---|---|
| 1 | `food` | a dish, a cuisine, a restaurant name | menu item + the restaurant, with "delivers to me / open now" | text + open-now + delivery | 1 |
| 2 | `retail` | product name, brand, model | product with price and stock | text + price + brand + availability | 7 |
| 3 | `services` | the job to be done ("house cleaning") | a provider who does that job in my area | job-to-be-done taxonomy + coverage area | 2 |
| 4 | `healthcare` | specialty, doctor's name, sometimes insurer | a named doctor with a bookable slot | specialty taxonomy + earliest availability | 2 |
| 5 | `realEstate` | buy/rent, property type, rooms, area, budget | a property listing | structured filters dominate; free text is secondary | 0 |
| 6 | `automotive` | **two intents**: "buy a car" (make/model/year) OR "fix my car" (mechanic/part) | a vehicle listing, or a garage | must be split; one search box cannot serve both | 0 |
| 7 | `beauty` | a service ("balayage", "mani-pedi") | a salon with the earliest slot and a price | service taxonomy + availability + price | 0 |
| 8 | `fitness` | "gym near me", a class type, a price ceiling | a gym / a class schedule / a membership tier | proximity + schedule | 0 |
| 9 | `sportsCourts` | sport + when | a **free court slot**, not a venue | availability-first; text is almost irrelevant | 0 |
| 10 | `education` | subject + level + format (online/in-person) | a course or a tutor | taxonomy + format + price | 0 |
| 11 | `events` | a venue for a date/capacity, or a ticket to a named event | venue with a free date, or a ticket type | date + capacity, or event name | 0 |
| 12 | `hospitality` | where + check-in/out + guests + budget | an available unit with a total price | **availability-first**; text least important | 0 (4 units, 0 stores in the sector) |
| 13 | `pharmacy` | a medicine or brand name, urgently | a pharmacy that has it and is open now | text + open-now; time-critical | 0 |
| 14 | `petCare` | animal type + service ("cat vaccination") | a clinic/groomer with a slot | taxonomy + availability | 0 |
| 15 | `professional` | discipline + specialisation + language | a named practitioner with a consultation fee | taxonomy + credentials | 1 |
| 16 | `contractors` | a trade, in colloquial Arabic (كهربجي, عفش) | a tradesman who **covers my area** | **synonym-driven taxonomy + coverage** — already built | 0 |
| 17 | `farm` | a produce name, or "vegetable box" | a product with a delivery day | text + delivery schedule | 0 |

Four distinct search shapes fall out of that table, and they are what a
configuration should encode:

- **`catalog`** — text over an item catalogue. `retail`, `pharmacy`, `farm`,
  `food`.
- **`directory`** — text over a *taxonomy of what people do*, plus coverage
  area. `services`, `contractors`, `professional`.
- **`availability`** — a date/time range is the primary key of the query, text is
  a rounding error. `hospitality`, `sportsCourts`, `events`, and the booking half
  of `beauty` / `healthcare` / `petCare` / `fitness`.
- **`listing`** — structured attributes dominate. `realEstate`, `automotive`
  (buy-side).

`automotive` needs two modes; that is not a defect in the taxonomy, it is a
genuine property of the sector and should be an explicit mode switch, not an
inference.

---

## 3. A configuration-driven design that extends `sectors.ts`

**Rule: no parallel registry.** `src/lib/sectors.ts` already is the sector
registry — `SectorConfig` (line 155) carries `features`, `modules`,
`customersNoun`, tints, and there are already helpers that read it
(`sectorHasTeam`, `sectorPrimarySetup`, `resolveStoreModules`). A second
`search-config.ts` keyed by `CategoryKey` would drift within one release.
`src/lib/attributes.ts` is likewise already the per-sector *field* registry, and
its `AttrField` type already carries a `filter?: boolean` flag (line 17).

### 3.1 Extend the existing type

Add one optional member to `SectorConfig` in `src/lib/sectors.ts`:

```ts
export type SectorSearch = {
  /** Which of the four shapes above this sector's search takes. */
  shape: "catalog" | "directory" | "availability" | "listing";
  /** The primary object a result row represents. */
  resultObject: "product" | "service" | "provider" | "unit" | "slot" | "listing";
  /** Optional taxonomy table driving suggestions (as `trades` does for
   *  contractors). null = free text over names only. */
  taxonomy: "trades" | "specialties" | "subjects" | "sports" | null;
  /** Which searchable/filterable fields apply — keys resolved against
   *  categoryAttributes[sector] and a small shared set. */
  fields: string[];
  /** Below this many live, visible offerings the vertical entry point is not
   *  rendered at all. See §4. */
  minInventory: number;
};
```

…and `search?: SectorSearch` on `SectorConfig`. Sectors that omit it fall back
to the current global search — which is the correct default for the twelve that
have no merchants.

The `fields` array must resolve against `categoryAttributes` in
`src/lib/attributes.ts` rather than restating field definitions, so the *same*
declaration drives the merchant's product form (`product-form.tsx:108-111`), the
storefront summary line (`attributeSummary`), and the marketplace filter. That
three-way reuse already half-exists — `store-products.tsx:279` picks the
`filter: true` fields to build in-store filters. Extending it outward to the
marketplace is a small step; building a second field registry is not.

### 3.2 One RPC, not seventeen

Do **not** ship `search_beauty`, `search_food`, `search_pharmacy`. Ship one
generalised RPC per *shape* — four functions, not seventeen:

- `search_offerings(p_q, p_sector, p_region, p_area, p_filters jsonb, p_limit, p_offset)`
  — covers `catalog` and `listing`. It is `search_products_fuzzy` plus a sector
  join to `business_types.slug`, a region predicate, and a `p_filters @>`
  containment test against `products.attributes`.
- `search_providers(p_q, p_taxonomy_slug, p_area, p_region, …)` — covers
  `directory`. This is literally `browse_crafts` (`0240`) with the taxonomy table
  parameterised.
- `search_availability(p_sector, p_region, p_from, p_to, p_party_size, …)` —
  covers `availability`. This is `search_stay` (`0191`) with `p_store_id` made
  optional and a region/area predicate added. **This is the single largest piece
  of missing search capability**, and it is one function.
- Keep `search_trades` and generalise it to `search_taxonomy(p_table, p_q)` so
  the synonym trick works for medical specialties and school subjects too. The
  synonym mechanism is the most valuable thing in the crafts vertical and it is
  currently locked to one table.

Each RPC must call `log_search` with the sector — which requires widening the
`search_logs.section` check constraint (`0216:31`) to accept the 17 sector slugs,
or replacing it with a `sector text` column. Do that **before** building
verticals, not after; see §5.

### 3.3 The synonym table is the real unlock

`trades.synonyms` (`0235:45`) is why كهربجي finds an electrician. The equivalent
does not exist for products: a customer typing "بامبرز" will not find
"حفاضات أطفال", and `search_products_fuzzy`'s trigram threshold of 0.2
(`0114:60`) will not save them — those two strings share almost no trigrams.

Recommendation: a generic `search_synonyms(term text, canonical text, sector text)`
table, admin-editable, applied inside `normalize_search`'s caller. Seed it from
`admin_search_gaps()` output — i.e. from real zero-result queries. Which requires
logging to work first. Everything routes back to §1.3 item 4.

---

## 4. Which sectors do not justify vertical search yet

This is the honest part.

**A vertical search entry point is a promise.** A tab that says "Stays" and
returns nothing teaches the customer that the site is empty, and they do not come
back to check. The crafts section is the live proof: 47 trade pages, 2 locales,
94 URLs, **0 providers**. That is not a hypothetical risk — it shipped.

Proposed gate, expressed as `minInventory` in the config above, evaluated per
sector against **visible offerings from distinct active merchants**:

| Live inventory | What renders |
|---|---|
| 0 offerings | No vertical entry point. Sector hidden from discovery navigation entirely. |
| 1–9 offerings, <3 merchants | Browse only — a flat, ungated list. No search box (a search box over 6 items is a worse list). No filters. |
| ≥10 offerings **and** ≥5 distinct merchants | Search box on, one facet on. |
| ≥50 offerings **and** ≥10 merchants | Full faceted vertical search for that sector. |

The gate must be computed from data, not hard-coded, or it becomes a lie the
moment inventory moves. A cached count per `(sector, region)` — the same
`unstable_cache` pattern already used by `fetchActiveStores`
(`stores.ts:75`) — is enough.

Applying that gate to production **today**:

| Sector | Visible offerings | Merchants | Verdict today |
|---|---|---|---|
| retail | 30 | 7 | **Search box + one facet (price or brand).** The only sector that clears the first bar. |
| healthcare | 6 | 2 | Browse only. |
| food | 3 | 1 | Browse only. One restaurant is not a food vertical. |
| services | 2 | 2 | Browse only. |
| professional | 0 | 1 | Nothing to render. |
| contractors | 0 | 0 | **Turn the entry point off** until providers exist. The 47 trade pages should `noindex` and the section link should be hidden — see `21_SEO_DISCOVERY.md`. |
| hospitality | 4 units, 0 sector stores | 0 | No marketplace stay search. Keep the per-store `search_stay` widget, which works. |
| beauty, fitness, sportsCourts, education, events, pharmacy, petCare, realEstate, automotive, farm | 0 | 0 | Nothing. Do not build search for a sector with no merchants. |

**Sixteen of seventeen sectors do not justify vertical search at current
inventory.** The binding constraint is not engineering; it is that there is
nothing to find. Building `search_beauty` now produces a function that will be
rewritten before the first salon signs up, against requirements guessed rather
than observed.

---

## 5. What to build first, in order

The ordering is chosen so that each step is useful on its own and none of them
depends on inventory that does not exist.

1. **Fix logging.** Call `log_search` from `/[lang]/search/page.tsx` (server
   side, after `searchAll` returns, with the real total). Widen
   `search_logs.section` to carry a sector. Cost: one page edit and one
   migration. Value: `admin_search_gaps()` starts producing the merchant
   acquisition list it was built for. Every day of delay is data that cannot be
   recovered. **Do this before anything else in this document.**
2. **Add the missing index**: trigram GIN on `products.name_en`, btree on
   `stores(region)`. Cost: one migration. Removes two sequential scans.
3. **Generalise `search_stay` to accept a null `p_store_id`** plus region/area.
   This is the one genuinely missing search *capability*, and it is ~30 lines.
   It stays dormant until hospitality merchants exist, and costs nothing while
   dormant.
4. **Add `search?: SectorSearch` to `sectorConfig`**, populate it for the five
   sectors that have merchants, and make the discovery navigation read
   `minInventory` so empty sectors stop being advertised. This is the change
   that stops the crafts failure from repeating.
5. **Introduce `search_synonyms`, seeded from real zero-result logs.** Not
   before step 1 — synonyms guessed in a meeting are worse than none.
6. Everything else waits for merchants.

---

## 6. What I could not verify

- **Search demand.** I have no analytics access and `search_logs` is empty. I do
  not know what anyone has ever searched for on Matjar. Any keyword list, search
  volume, or "top query" figure in the brief is unsourced — treat it as a guess
  until §5 step 1 ships and 30 days pass.
- **The GTM container's contents.** `GTM-M89LK69J` is loaded at
  `src/app/[lang]/layout.tsx:101`, but the container configuration lives in
  Google's UI, not the repo. Google Analytics may or may not be recording site
  search. I found no `dataLayer.push` anywhere in `src/`, so if it is recording
  anything it is automatic pageviews only.
- **Whether `search_products_fuzzy` errors in production.** `search_logs` being
  empty is consistent with either "nobody searched on /explore" or "the RPC call
  is failing silently" (`explore-client.tsx:144` is `void`-ed and never checked).
  Distinguishing these needs `query_logs`, which I did not run.
