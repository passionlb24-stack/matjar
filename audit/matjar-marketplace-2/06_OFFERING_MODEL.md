# 06 — Offering Model

**Scope:** Is one `products` table being made to carry physical goods, menu items, services,
classes, courses, units, tickets and listings? What is genuinely overloaded, what is already
split, and is a "constrained offering model" actually needed?

**Method:** live `information_schema` / `pg_catalog` reads against production
(`wesihatopiznatsyfxer`), plus the repo at `C:\Users\m-cha\Documents\gh\matjar`.
Row counts are live as of this audit.

---

## 1. Headline

**The premise that `products` is a catch-all is false.** Eight of the nine offering shapes
already have their own tables, created deliberately across migrations `0128`–`0193`.
`products` carries exactly three kinds — physical good, service, digital file — and that is
declared explicitly by a `products.item_kind` column, not inferred.

There is **one real overload**, and it is narrow: **real-estate properties and vehicles are
stored as `products` rows with a `jsonb` `attributes` blob**, with no dedicated entity and no
typed columns. That is the only place where the offering model is genuinely doing violence
to the domain.

---

## 2. What `products` actually is

`public.products` has 39 columns (live `information_schema.columns`). Grouped by purpose:

| Group | Columns |
|---|---|
| Identity | `id`, `store_id`, `name`, `name_en`, `brand`, `description`, `description_en`, `section_id`, `sku` |
| Kind discriminator | **`item_kind text NOT NULL DEFAULT 'product'`** |
| Money | `price`, `discount_price`, `cost`, `flash_price`, `flash_start`, `flash_end` |
| Merchandising | `image_url`, `gallery jsonb`, `sort_order`, `in_offers`, `in_clearance`, `deal_date`, `is_bundle`, `hidden_by_plan` |
| Stock | `stock`, `low_stock_threshold`, `is_available`, `status product_status` |
| Booking config | `booking_allocation_mode`, `duration_minutes`, `buffer_minutes`, `capacity_per_slot` |
| Digital delivery | `digital_path`, `digital_name`, `digital_size` |
| Free-form | **`attributes jsonb NOT NULL DEFAULT '{}'`** |
| Lifecycle | `created_at`, `updated_at`, `deleted_at` |

### 2.1 `item_kind` — a real discriminator, honoured end-to-end

`item_kind` was added in `0206_product_vs_service.sql`; the `digital` value in
`0234_digital_products.sql`. It is not decorative — it drives the storefront:

- `src/components/product-form.tsx:84` — merchant picks `service | product | digital`; the
  sector chooses only the **default**, never the ceiling
  (`src/components/product-form.tsx:70-86`, an explicit design note).
- `src/components/product-form.tsx:126-139` — booking columns are written **only** when
  `item_kind = 'service'`; `digital_*` only when `'digital'`; `stock` forced NULL for digital
  (`:155`).
- `src/app/[lang]/(site)/product/[id]/page.tsx:200-201` — the booking-vs-cart CTA is
  `product.itemKind === "service" || !isOrderSurface(category)`. Commented in-file as
  "Decided by the ITEM, not the sector".
- `src/components/store/store-products-section.tsx:81-82` — the storefront splits one item
  list into services and goods.
- `src/app/[lang]/(site)/orders/[id]/page.tsx:209` — digital download link gated on
  `item_kind === 'digital'`.

**Live usage (production):** 65 products — 52 `product`, 13 `service`, 0 `digital`.
So the discriminator is in real use for two of three values; `digital` is **built but unused**.

### 2.2 The booking columns are barely exercised

Of 65 products: `duration_minutes` set on **1**, `booking_allocation_mode` set on **1**,
`capacity_per_slot` set on **0**. The booking engine v2 (`0174_booking_engine.sql`) reads
these, and `reschedule_booking` falls back to `stores.booking_slot_minutes` when they are
null — so the fallback path is the one actually being used in production. This is
**built but effectively unused**, not missing.

Corroborating: all 22 live `bookings` rows have `starts_at IS NULL`. The v2 timestamp model
exists (with two GiST exclusion constraints, see doc 07) but every real booking still runs on
the v1 `requested_date` + `requested_time text` pair.

---

## 3. Offering types that are NOT on `products`

Every one of these is a separate first-class table with its own migration:

| Offering type | Table | Migration | Live rows |
|---|---|---|---|
| Accommodation unit (room/chalet) | `accommodation_units` | `0191_accommodation_engine.sql` | 4 |
| Event ticket type | `event_ticket_types` | `0193_event_tickets.sql` | 0 |
| Recurring class | `store_classes` | `0130_store_classes.sql` | 1 |
| Course | `store_courses` | `0134_store_courses.sql` | 2 |
| Membership plan | `store_membership_plans` | `0129_store_membership_plans.sql` | (plans table; 0 memberships) |
| Bookable resource (court/table/room) | `store_resources` | `0128_store_resources_timeslot.sql` | 2 |
| Classified listing (Sunday Market) | `listings` | `0036_sunday_market.sql` | 9 |
| Portfolio work | `store_portfolio` | — | 0 |
| Wholesale SKU | `wholesale_products` | — | — |
| Freelance gig | `gigs` | — | 3 |

Each carries the columns its domain actually needs, and they are not the same columns:

- `accommodation_units`: `max_guests`, `bedrooms`, `bathrooms`, `base_nightly_price`,
  `weekend_price`, `min_nights`, `cleaning_fee`, `security_deposit`, `check_in_time`,
  `check_out_time`, `cancellation_policy`, `amenities jsonb`, `images jsonb` — with CHECK
  constraints on every money column and on `max_guests` (1–50) and `min_nights` (1–90).
- `event_ticket_types`: `price`, `capacity`, `sold` (denormalised counter), `active`.
- `store_classes`: `day_of_week`, `start_time text`, `capacity`, `price`.
- `store_courses`: `price`, `duration text`, `schedule text`, `level text`.
- `store_membership_plans`: `price`, `period` (`monthly|quarterly|yearly`).
- `store_resources`: `open_hour int`, `close_hour int`, `price`.

**Menu items are not a separate type** — a restaurant dish is a `products` row with
`item_kind='product'`, plus `product_options` and `product_modifier_groups`
(`0194_food_modifiers.sql`). That is the correct call: a dish and a retail SKU share stock,
price, discount, section and image semantics almost exactly. Live: 6 `product_variants`,
0 `product_modifier_groups` — modifiers are **built but unused**.

---

## 4. The one genuine overload: property and vehicle listings

`src/lib/attributes.ts:23` defines `categoryAttributes` — typed field descriptors written
into `products.attributes jsonb`:

- `realEstate` → `purpose` (sale|rent), `ptype`, `rooms`, `bathrooms`, `area`, `furnished`
  (`src/lib/attributes.ts:30-70`)
- `automotive` → `brand`, `model`, `year`, `mileage`, `gearbox`, `fuel`, `condition`
  (`src/lib/attributes.ts:71-111`)
- `services` / `healthcare` → a single `duration` field, which **duplicates the typed
  `products.duration_minutes` column** (`src/lib/attributes.ts:24-29`). Two sources of truth
  for the same fact.

Five of those fields are flagged `filter: true` — i.e. they are meant to be **buyer-facing
search filters** — while living inside an untyped, unindexed, unconstrained JSON object.

**Live usage: 6 of 65 products have a non-empty `attributes`.** So the blob is thinly used
today, which is exactly why fixing it is cheap now and expensive later.

Concrete problems this creates:

1. **`price` has no meaning.** A `realEstate` product with `attributes.purpose='rent'` stores
   a monthly rent in the same `price numeric` column that a `purpose='sale'` row uses for a
   sale price. Nothing in the schema distinguishes them, so any sort, filter or "from $X"
   badge mixes $1,200/month with $180,000.
2. **Filters cannot be indexed meaningfully.** `attributes->>'rooms'` is text; a
   "3+ bedrooms" filter is a string comparison.
3. **No validation.** `products.attributes` is `jsonb NOT NULL DEFAULT '{}'` with no CHECK and
   no schema. A typo in `ptype` silently produces an unfilterable listing.
4. **Two listing concepts coexist.** `listings` (9 rows, `0036_sunday_market.sql`) is a real
   classified entity with `title`, `price`, `city`, `region`, `images`, `status` CHECK
   (`draft|pending|active|sold|rejected|expired`), `views`, and an expiry job
   (`expire_stale_listings`). Merchant products can cross-post into it
   (`src/components/product-form.tsx:221-238`). But a real-estate agency's inventory is
   `products`, not `listings` — so the platform has a listing table that the listing sectors
   do not use.

---

## 5. Assessment of the brief's proposed offering types

| Brief's proposed type | Reality | Verdict |
|---|---|---|
| Physical good | `products` `item_kind='product'` (52 rows) | **EXISTS** |
| Menu item | `products` + `product_options` + `product_modifier_groups` (`0194`) | **EXISTS** — deliberately not split; correct |
| Service | `products` `item_kind='service'` (13 rows) + booking config columns (`0174`) | **EXISTS** |
| Digital good | `products` `item_kind='digital'` + `digital_path/name/size` (`0234`) | **EXISTS, 0 rows** — built but unused |
| Class | `store_classes` (`0130`) | **EXISTS** |
| Course | `store_courses` (`0134`) | **EXISTS** |
| Accommodation unit | `accommodation_units` (`0191`) | **EXISTS**, richest non-product entity in the schema |
| Ticket type | `event_ticket_types` (`0193`) | **PARTIAL** — it is a *ticket type*, not an *event*: no date, time, venue or doors-open column |
| Membership plan | `store_membership_plans` (`0129`) | **EXISTS** |
| Bookable resource | `store_resources` (`0128`) | **PARTIAL** — `open_hour`/`close_hour` integers only; no per-weekday hours, no per-slot price |
| Classified listing | `listings` (`0036`) | **EXISTS** but unused by the listing sectors |
| Property | none — `products` + `attributes` jsonb | **MISSING** |
| Vehicle | none — `products` + `attributes` jsonb | **MISSING** |

---

## 6. Is a constrained offering model needed?

**No — not as a redesign. The current split is sound and should be preserved.**

The argument for a single constrained `offerings` table is that 17 sectors × N shapes is
unmanageable. The evidence contradicts that: the shapes really do differ (a nightly rate with
a weekend override, a min-stay and a security deposit have nothing in common with a ticket
capacity counter or a weekly class slot), and collapsing them would push every difference
back into a JSON blob — reintroducing exactly the problem this audit is asked to find.

What the codebase is missing is not a constrained model. It is **three narrower things**:

### 6.1 Promote the filterable listing attributes out of `jsonb`
Add typed, nullable columns for the five `filter: true` fields plus the sale/rent
distinction. Additive, non-destructive, backfillable from the 6 existing rows:

- `products.listing_purpose text` (`sale|rent`) + `products.rent_period text`
- `products.rooms smallint`, `products.area_sqm numeric`
- `products.vehicle_year smallint`, `products.mileage_km integer`
- keep `attributes` for the long tail (`furnished`, `gearbox`, `fuel`, `condition`)

This does not require a property table. It requires admitting that "is this a sale price or a
monthly rent" is a first-class fact, not an attribute.

### 6.2 Give `event_ticket_types` an event
A ticket type without a date is not a sellable offering — a customer cannot know what they are
buying. Either add `event_at timestamptz`, `event_ends_at`, `venue text` to
`event_ticket_types`, or add an `events` parent table. The former is smaller and sufficient
for single-date events, which is what a Lebanese venue actually runs.

### 6.3 Delete the duplicate `duration` attribute
`src/lib/attributes.ts:24-29` writes `attributes.duration` for `services` and `healthcare`,
while `products.duration_minutes` is the column the booking engine reads
(`reschedule_booking`, `place_booking`). One of these is dead. Remove the attribute field; keep
the column. Code-only change, no migration.

### 6.4 One structural gap worth naming
There is **no offering-type registry**. Which surface a sector shows is decided by five
`Set` literals inside `src/lib/store-experience.ts` (`DIRECTORY_ONLY_SECTORS:35`,
`STAY_SECTORS:41`, `TICKET_SECTORS:46`, `LEAD_SECTORS:54`) plus `sectorConfig[].features` in
`src/lib/sectors.ts:182`. These two files can and do drift — see doc 07 §11 for a live example
where the resolver's own comment (`src/lib/store-experience.ts:10, 29-32`) still claims the
stay and ticket engines "do not exist yet" while the code twelve lines below routes to them.
The registry should be one table or one file, not two.

---

## 7. Verdict

| Claim | Finding |
|---|---|
| "One `products` table carries everything" | **False.** It carries 3 declared kinds; 8 other offering types have dedicated tables. |
| "The offering model needs constraining" | **No.** The split is domain-correct. Do not collapse it. |
| "Avoid giant unstructured JSON blobs" | **Justified, but narrowly.** `products.attributes` is the only offering blob and holds only 6 rows' worth of data — fix it now while it is cheap. `gallery`, `amenities`, `images` are legitimate list-of-scalars uses. |
| "Real estate and automotive are modelled" | **Barely.** They are products with a JSON sidecar, in sectors that are held directory-only anyway. |
