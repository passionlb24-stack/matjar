# 09 — Vertical Filters

Checkpoint-0 audit. Read-only. Companion to `08_VERTICAL_SEARCH.md`; the
inventory numbers in §0 of that file apply here unchanged and are the reason
most of this document is a "not yet" rather than a "here is the spec".

---

## 1. What filters exist today, exactly

There are **four** filtering surfaces in the product, and only one of them is
per-sector.

### 1.1 `/explore` and `/category/[slug]` — the marketplace grid

`src/app/[lang]/(site)/explore/page.tsx:32` accepts exactly three search
params: `{ q, region, group }`. Nothing else. Both routes render
`src/components/explore-client.tsx`, and all filtering happens **client-side**
over the server-supplied store array (`explore-client.tsx:189-204`):

| Control | Values | Where | Server or client |
|---|---|---|---|
| Group | 9 `groupKeys` (`catalog.ts:57`) | chip row, `explore-client.tsx:284` | client |
| Category | 17 `categoryKeys`, only settable via `/category/[slug]` | `category/[slug]/page.tsx:54` | client |
| Region | 5 `regions` (`catalog.ts:103`) | chips (desktop) / bottom sheet (mobile) | client |
| Free text | store name substring + `search_products_fuzzy` union | `explore-client.tsx:193-201` | mixed |
| Sort | `recommended \| nearest \| topRated \| newest \| openNow` | `explore-client.tsx:61` | client |

`openNow` is implemented as a *sort mode* that secretly filters
(`explore-client.tsx:217-220`) — a real usability wrinkle: the user picks one
thing from a "sort" list and the result count changes.

**The store list itself is capped at 200 rows** (`STORE_FETCH_LIMIT`,
`src/lib/data/stores.ts:68`) and cached 60s. Every filter above operates on that
window. The comment there already flags this: "Raise or move to server-side
pagination / PostGIS nearest-search when store count nears it." Any real filter
engine must move server-side first; adding facets to a client-side filter over a
capped 200-row array is building on the wrong foundation.

**Filters never reach the URL.** `/explore` *reads* `q`/`region`/`group` from
`searchParams` on first render (page.tsx:42-50) and then keeps them in React
state (`explore-client.tsx:82-86`) with no `router.replace`. So a filtered view
cannot be shared, cannot be bookmarked, breaks the back button, and — the point
that matters for `21_SEO_DISCOVERY.md` — **cannot be linked to or indexed**.
This is the single most consequential filter defect on the platform, and it is a
handful of lines to fix.

### 1.2 Sunday Market — the one that does it right

`src/app/[lang]/(site)/market/page.tsx:46-52` reads `category`, `region`, `city`
from `searchParams` and filters **server-side**. URL-driven, shareable,
indexable. This is the pattern `/explore` should adopt; it already exists in the
codebase.

### 1.3 In-store product filters — the one per-sector filter that exists

`src/components/store-products.tsx:275-292` builds filters from
`categoryAttributes[category].filter(f => f.filter)` — i.e. from
`src/lib/attributes.ts`. Only two sectors declare filterable fields today
(`attributes.ts:23-112`):

| Sector | Filterable fields declared | Non-filterable fields also declared |
|---|---|---|
| `realEstate` | `purpose` (sale/rent), `ptype`, `rooms` | `bathrooms`, `area`, `furnished` |
| `automotive` | `brand`, `gearbox`, `fuel`, `condition` | `model`, `year`, `mileage` |
| `services`, `healthcare` | — | `duration` |
| other 13 sectors | — | — |

Plus a brand chip row derived from distinct `products.brand` values
(`store-products.tsx:283-289`).

**Two behaviours here are already correct and must be preserved when this moves
to the marketplace:**

1. `shownFilterFields` (line 836) only renders a field when
   `fieldChoices(f).length > 0` — a filter with no values present is not shown.
2. `fieldChoices` (line 815) derives text/number options from values that
   **actually exist in this catalogue**, so a "rooms" dropdown never offers 7
   bedrooms when nothing has 7.

That is the anti-zero-result discipline the whole marketplace needs. It exists,
inside one component, for one store at a time.

### 1.4 Crafts directory

`browse_crafts` (`0240_browse_crafts_reads_providers.sql`) filters by `p_trade`,
`p_area`, `p_region`, `p_q`, `p_sort` — all server-side, all URL-driven via
`/[lang]/crafts/[trade]?area=…&sort=…`. Correct design. Returns nothing:
`craft_providers` has 0 rows.

---

## 2. The proposed per-sector filter sets, against what exists

Below, per sector: the filters the brief proposes, and whether the underlying
data exists. **"Exists"** means a real column I verified in
`information_schema.columns` on production. **"Proposed"** means it does not
exist anywhere and would need a migration. **"attributes"** means it can be
stored in the existing `products.attributes jsonb` (`0015_product_attributes.sql`)
with no schema change but no indexing either.

### Shared across all sectors

| Filter | Source of truth | Status |
|---|---|---|
| Region | `stores.region` (text, 5 values) | **Exists**, unindexed |
| Area / neighbourhood | `stores.area` (text) | **Exists but unusable** — see §3 |
| Sector | `stores.business_type_id` → `business_types.slug` | Exists, indexed |
| Open now | `stores.hours` jsonb (`0075_structured_hours.sql`), computed in JS | Exists, not filterable in SQL |
| Rating | `stores.rating_avg`, `stores.rating_count` (`0091`) | Exists, unindexed |
| Verified | `stores.is_verified`, `store_verifications` (`0126`) | Exists |
| Delivery / pickup | `stores.accepts_delivery`, `stores.accepts_pickup` | Exists |
| Price | `products.price`, `products.discount_price`, `products.flash_price` | Exists, unindexed |
| Distance | `stores.lat/lng` + `store_locations` (`0084`) | Exists; 5 of 13 active stores have coordinates |

### Per sector

| Sector | Proposed filters | Column status |
|---|---|---|
| `food` | cuisine, dietary (veg/halal), delivery, open now, min order, prep time | cuisine **proposed**; `stores.min_order`, `stores.prep_time`, `accepts_delivery` **exist**; dietary **proposed** (`food_modifiers` from `0194` models add-ons, not diets) |
| `retail` | brand, price range, in stock, condition, size/colour | `products.brand` **exists** (indexed, `products_brand_trgm_idx`); `products.stock` **exists**; `product_variants.color`/`.size` **exist** (`0181`) but **0 of 6 variants populate them**; condition **proposed** |
| `services` | job type, service area, callout fee, response time | job taxonomy **exists as `trades`** (47 rows) but is bound to crafts, not to `services` stores; service area **exists** as `lb_areas` + `craft_provider_areas`, again crafts-only; `stores.service_area` free text exists |
| `healthcare` | specialty, gender, insurance accepted, languages, next available | `doctors` table **exists** (`0026`, 2 rows); `stores.specialties`, `stores.insurance` are **free text**, not enumerated; gender/languages **proposed**; next-available derivable from `bookings` + `booked_times` |
| `realEstate` | purpose, property type, rooms, bathrooms, area m², furnished, price | **All exist** in `products.attributes` and are already declared in `attributes.ts:30-70`. Only `purpose`, `ptype`, `rooms` are flagged `filter: true`. |
| `automotive` | make, model, year, mileage, gearbox, fuel, condition, price | **All exist** in `attributes.ts:71-111`. `brand`/`gearbox`/`fuel`/`condition` flagged filterable. |
| `beauty` | service type, gender served, price, earliest slot, home service | service type = `products` rows with `item_kind='service'` (**exists**, `0206`); duration **exists**; gender/home-service **proposed**; earliest slot derivable from `bookings` |
| `fitness` | class type, membership price, schedule, facilities | `store_classes` (`0130`, 1 row) and `store_membership_plans` (`0129`, 2 rows) **exist**; facilities **proposed** |
| `sportsCourts` | sport, surface, indoor/outdoor, date+time free, price/hour | `store_resources` (`0128`) **exists**; sport/surface/indoor **proposed**; availability from `bookings` + `booked_times` (`0072`, `0145`) |
| `education` | subject, level, format (online/onsite), price, schedule | `store_courses` (`0134`) **exists**; subject/level/format **proposed** |
| `events` | event type, date, capacity, venue type, ticket price | `event_ticket_types` (`0193`) **exists, 0 rows**; capacity partially via `bookings.party_size` (`0131`); event type/venue type **proposed** |
| `hospitality` | check-in/out, guests, unit type, bedrooms, amenities, price/night | **All exist** on `accommodation_units` (`0191:17-41`): `unit_type`, `max_guests`, `bedrooms`, `bathrooms`, `amenities jsonb`, `base_nightly_price`, `min_nights`. Best-modelled sector on the platform. 4 rows. |
| `pharmacy` | open now, delivers, prescription required, in stock | open-now/delivery **exist**; prescription-required **proposed** |
| `petCare` | animal type, service, home visit | all **proposed** |
| `professional` | discipline, specialisation, language, consultation fee, remote | discipline could reuse `trades`; the rest **proposed**; fee = `products.price` |
| `contractors` | trade, service area, verified, price-from, years experience | **All exist**: `trades`, `craft_provider_areas`, `craft_providers.verified`, `craft_services.price`, `craft_providers.years_experience` |
| `farm` | produce type, organic, delivery day, box/subscription | all **proposed** |

**Summary:** of the 17 sectors, **4** (`realEstate`, `automotive`,
`hospitality`, `contractors`) have their filter columns fully modelled already.
`retail` is close. The other 12 would need new columns — and 12 of the 17 have
zero merchants, so those columns would be designed against zero real examples.

---

## 3. The area problem — the biggest data gap for filtering

`stores.area` is **free text**. Here is every distinct value across all 13 active
stores, verified by query:

```
(null) ×3, "Tripoli", "طرابلس - التربيعة",
"طرابلس - ابي سمراء - طريق الجنان",
"طرابلس الزاهرية بجانب مدرسة مي للبنات",
"طرابلس اشارة الميتين بناية المكاتب الطابق الأول",
"طرابلس شارع المعرض", "طرابلس عزمي بجانب مستشفى الاسلامي",
"طرابلس, ابو سمرا, شارع الزيتون بجانب سرفيس الندى",
"الضنية مراح السراج مقابل الطريق العام",
"العيرونية زغرتا طريق عام"
```

Thirteen stores, twelve distinct strings, zero of which can be grouped. Merchants
are typing directions, not a place name. **You cannot build an area filter on
this column**, and you cannot build `/{location}/{sector}` pages on it either.

Meanwhile `lb_areas` **does** exist — 45 rows, a proper controlled vocabulary
with `slug`, `region`, `name_ar`, `name_en`, `sort_order`
(`0235_crafts_taxonomy_and_service_areas.sql:53`), broken down as
mountLebanon 13, north 12, bekaa 7, south 7, beirut 6. It is used by exactly one
feature (crafts) and referenced by zero stores — the `store_service_areas` table
from `0235` was **dropped** in `0240` when providers moved off `stores`.

**Recommendation, and it is cheap:** add `stores.area_id uuid references lb_areas(id)`
and put a required `lb_areas` picker in the store edit form, keeping the free-text
`address` for the "next to the pharmacy" detail. Backfilling 13 stores is a
one-afternoon job today; at 500 stores it is a data-cleanup project. This is the
single highest-leverage schema change in this document, and it unblocks area
filtering, "near me" for stores without coordinates, and every location-based SEO
page discussed in `21_SEO_DISCOVERY.md`.

---

## 4. Indexes required

Verified against `pg_indexes` on production. Nothing below exists today.

| Index | For | Priority |
|---|---|---|
| `products` GIN trigram on `name_en` | `search_products_fuzzy` filters on `name_en` (`0114:42,59`) with no index — sequential scan | **P0** (correctness of an existing query) |
| `stores (region)` btree | every region filter | **P0** |
| `stores (region, business_type_id)` | region × sector — the core marketplace facet | P1 |
| `products` GIN on `attributes jsonb_path_ops` | any `attributes @> '{"gearbox":"automatic"}'` filter | P1, **only when realEstate/automotive merchants exist** |
| `products (store_id, price)` or partial on visible rows | price range / sort | P1 |
| `stores (rating_avg desc)` partial `where status='active'` | "top rated" moved server-side | P2 |
| `stores (area_id)` | after §3 lands | P2 |
| `accommodation_units (store_id, active, max_guests)` | marketplace stay search | P2 (dormant until inventory) |

Existing and adequate: `products_name_trgm`, `products_brand_trgm_idx`,
`products_store_kind_idx`, `listings_title_trgm`, `stores_name_trgm`,
`craft_providers_region_idx`, `lb_areas_region_idx`, `trades_group_idx`.

At 13 stores and 60 products **none of these indexes changes a response time
today**. They are cheap insurance, not a fix for a live problem — and it would be
dishonest to present them as a performance win. The `name_en` one is different:
it is a latent bug in a query that already ships.

---

## 5. The mobile filter experience

What exists (`explore-client.tsx:302-331`, `435-505`):

- Below `lg`, region and sort collapse into a single **Filters** button that
  shows an active count badge, opening a `BottomSheet`.
- Selecting a value **closes the sheet immediately** — deliberately, since both
  controls are single-select; the comment at line 432 explains that an Apply
  button for a radio list is a second tap for nothing. That reasoning is sound
  and should be kept for single-select facets.
- A "clear filters" link appears next to the button when anything is active.
- The group chips stay in a horizontally scrolling row above (line 274) with
  scrollbars hidden — a good call, since 9 chips wrapping to three rows pushes
  results below the fold.

What is missing, and what will break as soon as filters become multi-select:

1. **No result count before applying.** The sheet closes and *then* the count
   changes. For multi-select facets the count must be live inside the sheet
   ("Show 6 results"), and the Apply button becomes necessary again.
2. **No per-option counts.** A facet option that would return zero results
   should be disabled with its count shown, not silently selectable. The
   in-store filter already does the equivalent (`store-products.tsx:836`) — the
   marketplace does not.
3. **No selected-filter chips** above the grid. On a phone, once the sheet
   closes the only trace of active filters is a number in a badge. The user
   cannot see *which* filters are on without reopening the sheet.
4. **No URL state**, so the phone's back gesture exits the whole page rather
   than undoing a filter — the single most common way a mobile user "clears" a
   filter. This is the same defect as §1.1 and it is felt hardest on mobile.
5. **Sort and filter are in the same sheet under one "Filters" label**, and
   `openNow` is a sort option that filters. Separate them: a `Sort` control and a
   `Filters` control, as `/market` and every marketplace convention do.
6. RTL: chips and sheet inherit `dir` from `<html>` (`layout.tsx:84`), which is
   correct. The horizontal scroll row scrolls the right way in Arabic. No defect
   found — worth stating explicitly since it is the usual failure mode.

---

## 6. The zero-result problem, with the actual arithmetic

This is the reason to be conservative.

13 active stores. All in one region. Distributed retail 7 / healthcare 2 /
services 2 / food 1 / professional 1.

- Region filter alone: `north` → 13, every other region → **0**. Four of the
  five region chips already return an empty grid today.
- Group filter alone: `shopping` → 7, `health` → 2, `services` → 3, `food` → 1,
  and `sports`, `bookings`, `realEstate`, `automotive`, `education` → **0**.
  Five of the nine group chips return nothing.
- **Any two facets combined**: the largest possible non-empty cell is
  north × shopping = 7. Every other pair is ≤3 or zero.
- Add a third facet (price, rating, open-now) and the modal outcome is **zero**.

A filter panel is a promise that the axis it offers is populated. Offering
"Beirut" and "Automotive" when the answer is always empty is not a neutral
inconvenience — it is the platform telling a first-time visitor it is empty, in
their first ten seconds, more convincingly than an empty homepage would.

### Rules to adopt

1. **Never render a facet option that would return zero.** Compute per-option
   counts server-side alongside the result set (a `GROUP BY` on the same filtered
   base, one extra query), and either hide or disable-with-count the zeroes.
   Cache it with the existing `unstable_cache` pattern.
2. **Never render a facet with fewer than 2 non-empty options.** A "Region"
   chip row where only one chip works is worse than no region control at all.
   This rule alone removes the region filter from `/explore` today — correctly.
3. **Never render a facet for a sector with no merchants.** Tie it to the
   `minInventory` gate proposed in `08_VERTICAL_SEARCH.md` §3.1, read from live
   counts, not hard-coded.
4. **When a filter combination genuinely returns zero, the empty state must
   remove the last filter, not just apologise.** Today `explore-client.tsx:427`
   renders `dict.explore.empty` — a dead end with no recovery action. Minimum:
   "No results in Beirut. Show all regions →".
5. **Log the zero.** Every zero-result *filter* combination is the same signal as
   a zero-result *search*: demand with no supply. `log_search` records only free
   text and only from one call site (`08_VERTICAL_SEARCH.md` §1.3). Widen it, or
   the filter engine will generate the platform's most valuable acquisition
   signal and throw it away.

---

## 7. Recommendation for Checkpoint 0

Do **not** build a per-sector filter engine now. Build the four things that make
one possible later and are worth having regardless:

1. **Push `/explore` filter state into the URL** and move filtering server-side
   with proper pagination, copying the `/market` pattern that already exists in
   this repo. Fixes shareability, the back button, and indexability at once.
2. **Add `stores.area_id → lb_areas`** and make the store form use it (§3).
   Every location feature on the roadmap is blocked behind this.
3. **Add the two P0 indexes** (§4).
4. **Add per-option counts and the "hide empty facets" rule** to the existing
   region/group chips (§6 rules 1–2). At current inventory this *removes* UI
   rather than adding it, and that is the correct outcome.

Then extend `categoryAttributes` with more `filter: true` fields **only for
sectors that have merchants**, and only after `search_logs` has 30 days of real
queries to say which facets people actually reach for.

---

## 8. What I could not verify

- Whether any user has ever changed a filter on `/explore`. Filter state never
  reaches the URL and no `filter_applied` event is recorded anywhere (see
  `20_ANALYTICS_FUNNEL.md`), so there is no evidence either way. Every claim
  about which filters people want is a guess, including mine.
- Mobile rendering on a real device. I read the components; I did not run the
  app. The RTL and bottom-sheet assessments above are from source, not from a
  screen.
- Whether `products.attributes` filtering performs acceptably at scale — 6 of 60
  products carry any attributes at all, so there is nothing to measure.
