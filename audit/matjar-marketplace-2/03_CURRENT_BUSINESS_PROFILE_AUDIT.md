# 03 — Current Business Profile Audit

**Scope:** what a customer actually sees on a Matjar business profile today, per sector, read from the code rather than from the brief.
**Method:** full read of `src/app/[lang]/(site)/store/[id]/page.tsx` (727 lines) and every component it renders. Every claim below carries a `file:line`.
**Status legend used throughout:** `EXISTS` (built and rendering) · `EXISTS-EMPTY` (built, zero production rows) · `EXISTS-UNGATED` (built, but not driven by the module registry) · `MISSING` (no code).

---

## 0. The correction that governs this whole document set

The commissioning brief asks for a "Business Profile Engine 2.0" to be invented, on the premise that every business gets the same generic page.

**That premise is wrong.** A module-driven profile engine already exists and has existed for some time:

- `src/lib/modules-catalog.ts:16-43` defines 23 `FeatureModuleKey`s and `withDependencies()` (`:105-116`).
- `src/lib/sectors.ts:182-407` assigns each of the 17 sectors a default module bundle (`SectorConfig.features`).
- `supabase/migrations/0127_store_modules.sql` gives every store a per-module override row (`store_modules(store_id, module_key, enabled, config)`), public-readable so the storefront can resolve it.
- `src/lib/sectors.ts:445-457` (`resolveStoreModules`) overlays the two and pulls in dependencies.
- `src/app/[lang]/(site)/store/[id]/page.tsx:209` calls it, and gates public sections on the result.
- `src/lib/store-experience.ts:111-189` derives the transaction surface from the resolved module set rather than from a slug list — and its own header comment (`:8-14`) documents the earlier slug-list bug it replaced.

So the real question is not "should we build a profile engine". It is **how deep the existing engine actually goes**, and the honest answer is: the engine decides *presence* well and *sequence* not at all, and 13 of its 23 declared modules do nothing on the public page.

---

## 1. The actual page: section inventory and fixed order

Every real store, in every one of the 17 sectors, renders this exact JSX sequence. There is no per-sector ordering anywhere.

| # | Section | Line | Gate |
|---|---------|------|------|
| 1 | Announcement bar | `page.tsx:542-551` | `store.announcement` non-null |
| 2 | Hero / cover | `page.tsx:552-559` | always |
| 3 | Identity header card | `page.tsx:562-574` | always |
| 4 | Branches | `page.tsx:576-578` | `branches.length > 1` |
| 5 | Courier delivery options | `page.tsx:580-582` | `couriers.length > 0` |
| 6 | Map | `page.tsx:584-592` | `mapPins.length > 0 && enabledModules.has("location")` |
| 7 | Service-request form | `page.tsx:594-605` | `experience.showServiceRequest` |
| 8 | Lead form | `page.tsx:607-616` | `experience.showLeadForm` |
| 9 | Stay search | `page.tsx:618-622` | `experience.showStay` |
| 10 | Event tickets | `page.tsx:624-628` | `experience.showTickets` |
| 11 | Time-slot booking | `page.tsx:630-639` | `resources.length > 0 && experience.allowResourceBooking` |
| 12 | Memberships | `page.tsx:641-648` | `membershipPlans.length > 0` |
| 13 | Classes | `page.tsx:650-659` | `classes.length > 0 && experience.allowResourceBooking` |
| 14 | Reservations | `page.tsx:661-663` | `enabledModules.has("reservations")` |
| 15 | Courses | `page.tsx:665-667` | `courses.length > 0` |
| 16 | Portfolio | `page.tsx:669-671` | `portfolio.length > 0` |
| 17 | Products / services / listings | `page.tsx:673-697` | always (real stores) |
| 18 | Healthcare info | `page.tsx:699-702` | `store.category === "healthcare"` **(hardcoded slug)** |
| 19 | Team / doctors | `page.tsx:704` | `doctors.length > 0` |
| 20 | Verifications | `page.tsx:706-712` | `enabledModules.has("verifications")` |
| 21 | Reviews | `page.tsx:714-722` | `store.isReal` **(not module-gated)** |

**Finding 1.1 — order is hardcoded, not configured.** `SectorConfig` (`sectors.ts:155-169`) carries `Icon`, `heroTint`, `iconTint`, `customersNoun`, `features` and `modules` — the OS-dashboard module *order* per group (`modules: Record<OsGroupKey, OsModuleKey[]>`) is ordered, but the **public profile has no ordering field at all**. The merchant dashboard gets sector-aware sequencing; the customer-facing page does not. This is the single largest structural gap and is what file `05_SECTOR_PROFILE_MATRIX.md` addresses.

**Finding 1.2 — the consequence is visible.** A clinic and a salon show their practitioners at position 19, *after* the service list at 17 and after every commerce block — even though for those sectors the practitioner is what the customer is choosing. A contractor's proof-of-work gallery sits at 16, below a map at 6. A restaurant shows a courier list (5) and a map (6) before its menu (17).

**Finding 1.3 — two hardcoded slug checks survive inside a registry-driven page.**
- `page.tsx:699` — `store.category === "healthcare"` gates specialties/insurance. Every other sector with an equivalent need (insurance for a vet, accreditation body for a school) has nowhere to put it.
- `page.tsx:499-504` — the section heading is chosen by a five-branch slug switch (`food` → menu, `services`/`healthcare` → services, `realEstate`/`automotive` → listings, else products). Twelve of 17 sectors fall through to the generic "products" label, including hospitality, events, fitness and education.

---

## 2. Module coverage: what the engine actually gates

Exhaustive grep of every consumer of the module registry (`resolveStoreModules`, `sectorDefaultModules`, `sectorHasTeam`, `MODULE_CATALOG`) returns **five files**: the public store page, the merchant modules page, the merchant doctors page, and the two product forms. `resolveStoreModules` has exactly **one** caller — `page.tsx:209`.

`modules-catalog.ts:5-8` claims "the merchant dashboard, the public profile, the create form, the search filters" all render from the enabled set. Only the public profile does. That comment is aspirational and should be corrected.

Of the 23 declared `FeatureModuleKey`s:

**Genuinely gating a public surface (10):**
`appointments` (`store-experience.ts:117`), `requests` (`:118`), `timeslot` (`page.tsx:216`), `memberships` (`:226`), `classes` (`:236`), `portfolio` (`:247`), `courses` (`:257`), `location` (`:584`), `reservations` (`:661`), `verifications` (`:706`).

**Declared but with zero readers anywhere in `src/` (6):**
`catalog`, `pos`, `rentals`, `listings`, `marketing`, `media`.

`media` is the most consequential of these. It is in the default bundle of **15 of 17 sectors** (all but `pharmacy` at `sectors.ts:344` and `professional` at `:370`) and nothing in the codebase reads it. A merchant can toggle "media" off in `/merchant/[id]/modules` and the cover photo stays.

**Rendering unconditionally, ignoring their own module flag (4):**
- `reviews` — `StoreReviews` renders on `store.isReal` alone (`page.tsx:714`). Switching the module off does nothing.
- `messaging` — `MessageStoreButton` renders on `store.isReal` (`store-header.tsx:180-182`).
- `delivery` — `StoreDeliveryOptions` renders on `couriers.length > 0` (`page.tsx:580`); zones are fetched with no module check (`:398-418`).
- `orders`/`menu`/`inventory` — the cart surface comes from `experience.canOrderProducts`, which `store-experience.ts:183` sets to a flat `true` for every non-directory sector regardless of whether `orders` is enabled.

**Gated at sector level only, override ignored (1):**
- `team` — `sectorHasTeam()` (`sectors.ts:438-440`) reads `sectorConfig[category].features` **directly**, not the resolved set. A store that disables `team` in the modules manager still renders its roster (`page.tsx:272`, `:704`). This is a real bug, not a design choice: every other module honours the override.

**Finding 2.1 — the merchant cannot add a module their sector did not ship with.** `merchant/[storeId]/modules/page.tsx:68` builds the toggle list from `sectorDefaultModules(category)` only. The override table supports enabling anything; the UI offers subtraction only. A restaurant cannot turn on `portfolio` to show its dining room; a salon cannot turn on `memberships`.

---

## 3. The brief's seven questions, answered against the real page

### Q1 — "What is this?"

**EXISTS, thin.** `StoreHeader` (`store/store-header.tsx:48-228`) renders: logo or category-icon fallback (`:52-62`), name (`:65-67`), Pro badge (`:73`), commercial-registration badge (`:75-79`), verified badge (`:80-85`), category label (`:87`), and the free-text `store.description` under a rule (`:221-225`).

Gaps: the category label is the *sector* name ("Healthcare"), not what the business does ("pediatric clinic"). There is no tagline, no year-established, no "what makes us different", no structured specialisation for any sector except healthcare (`store-healthcare-info.tsx`, gated on the hardcoded slug). `description` is one untyped text column on `stores` (`store-view.ts:111`) with no length guidance and no English/Arabic split — `store-view.ts` carries `descriptionEn` for *products* (`:65`) but not for the store itself.

### Q2 — "Where is it?"

**EXISTS, and disproportionately prominent.** Area chip in the header (`store-header.tsx:113-118`), branch list when `> 1` (`page.tsx:576`, `store/store-branches.tsx`), Leaflet map when coordinates exist and `location` is on (`page.tsx:584-592`), JSON-LD geo from `branches[0]` (`page.tsx:527-528`).

Gaps and a data problem: **only 3 of 11 active stores carry map coordinates**, so for 8 of 11 the map section does not render at all. `store-branches.tsx:12-49` shows name/address/phone but no per-branch hours and no map link. The JSON-LD reads `branches[0].lat` (`page.tsx:527`) while the visible map pin prefers `store.lat/lng` (`page.tsx:462-463`) — two different sources for the same fact. There is no distance-from-me, no "get directions" link, and no service-area concept for the sectors that travel to the customer (`contractors`, `services`) — even though `craft_provider_areas` (`migrations/0238_craft_providers_standalone.sql`) implements exactly that for the parallel crafts directory.

### Q3 — "Can I trust it?"

**EXISTS, the strongest part of the page.** Three independent signals:
- **Verifications** — `store_verifications` rendered by `store-verifications.tsx:29-...`, with a deliberate and well-reasoned split between "self-declared" and admin-"verified" (`:17-28`), and `doc_url` excluded from the query at source (`page.tsx:180-184`) so the scanned document never reaches the browser. This is genuinely good work.
- **Fulfilled-order count** — `store_fulfilled_count` RPC (`page.tsx:305-308`), badge at `store-header.tsx:98-106`. Behavioural proof, not a claim.
- **Reviews** — `reviews` table (`migrations/0009_reviews.sql`), one row per customer per store, rendered at `page.tsx:714`.

Gaps: reviews carry no date on screen, no verified-purchase marker, no merchant reply, no photos, no sort or filter, and no aggregate breakdown — `store-reviews.tsx:53-...` is a flat reverse-chronological list. Production holds **5 rows in `reviews`** across 11 stores, so for most profiles this section renders as an empty prompt. `product_reviews` (1 row) and `craft_reviews` exist as separate tables and never appear on the store profile. There is no response SLA, no "member since", and no dispute/report path.

### Q4 — "What does it offer?"

**EXISTS, and this is where the engine does its best work.** `StoreProductsSection` (`store/store-products-section.tsx:22-359`) branches on `experience.itemSurface`:
- `appointment` → `BookingPanel` over `item_kind = 'service'` rows, with provider picker, per-service duration/buffer/capacity (`:95-130`)
- `order` → `StoreProducts` cart with variants, bundles, flash pricing, zones, loyalty (`:131-181`)
- `catalog` → browse-only grid with a contact CTA (`:182-259`)

and critically, a store can render **both** — `showGoodsSection` (`:86-87`) gives a vet clinic a cart for pet food beneath its appointment engine. The comment at `:77-80` documents the `item_kind` split that made this possible.

Gaps: the section *heading* is a slug switch (`page.tsx:499-504`), so a hotel's units and a gym's classes are both labelled "products". Sector-specific offering shapes live in their own components with no shared contract — `StoreCourses`, `StoreMemberships`, `ClassesBooking`, `EventTickets`, `StaySearch`, `TimeslotBooking` are six separate top-level sections stacked in fixed order rather than one "offerings" region with sector-chosen tabs.

### Q5 — "How much?"

**EXISTS, inconsistently.** Prices render per surface: cart (`store-products.tsx` via `StoreProductsSection:131`), membership plans with period (`page.tsx:641`), courses (`:665`), courier fee (`store-delivery-options.tsx:32-36`), delivery zones with `min_order`/`free_over`/ETA (`page.tsx:399-417`). USD↔LBP conversion is live (`getUsdLbpRate`, `page.tsx:304`).

Gaps: there is no profile-level price signal at all — no "$$" band, no "from $X", no typical-callout price. The `catalog` surface shows `dict.store.from` + price per card (`store-products-section.tsx:247-252`), but a customer scanning a list of 11 stores gets no price context before opening one. Trades price in five different ways — `craft_services.pricing_type` (`fixed|from|hourly|per_meter|quote`, `migrations/0238:78-79`) already models this — and none of that vocabulary exists on the store side.

### Q6 — "Is it available?"

**EXISTS, and correct.** `store-header.tsx:119-157` parses the structured `hours` grid, reads the clock server-side once per request, and renders a live open/closed pill plus today's span. The comment at `:68-72` records the removal of an earlier pill that was reading platform-approval status and claiming "open" at 3am. Provider-level availability is deeper still: `provider_availability_rules` and `provider_availability_exceptions` (read at `merchant/[storeId]/doctors/page.tsx:97-111`) give per-practitioner weekly hours and day-off blocks.

Gaps: the public page shows *today's* span only — no week view, no holiday notice, no "next available slot" summary anywhere on the profile (the earliest slot is computed inside `BookingPanel`, not surfaced above the fold). Branches have a `phone` but no hours (`page.tsx:451`), so a two-branch store shows one set of hours for both. There is no lead-time or response-time signal for the request/lead sectors.

### Q7 — "What next?"

**EXISTS, arguably over-supplied.** The header renders up to eight actions side by side (`store-header.tsx:162-218`): Follow, Share, Message, Call, WhatsApp, Instagram, Facebook, Website. Below, the sector's real CTA appears in one of the transaction sections (7–17).

Gaps: no primary/secondary hierarchy — the sector's actual conversion action (book, order, request a quote) is not in the header at all, it is 600px down the page, while Instagram and Facebook are at the top. There is no sticky mobile action bar. For `realEstate` and `automotive` the `LeadForm` (`page.tsx:607`) is the correct action and sits at position 8, above the listings it refers to.

---

## 4. Per-sector: what a customer sees today

Derived from `sectorConfig` (`sectors.ts:182-407`) crossed with the gate table in §1. "Renders" lists only sections that can appear for that sector.

| Sector | Transaction surface today | Sections that can render | The notable absence |
|---|---|---|---|
| `food` | `order` cart (`store-experience.ts:171-176`) | announcement, hero, header, branches, couriers, map, reservations, menu-as-products, reviews | No menu structure beyond `store_sections`; reservations render with no table/party-size concept; no dish photos gallery |
| `retail` | `order` cart | same as food minus reservations, plus brand filter (`page.tsx:147`) | No storefront gallery; `marketing` module is dead code |
| `services` | `appointment` if `appointments` on — but `services` features are `requests`+`portfolio`, so surface is `catalog` + request form | request form, portfolio, catalog grid, verifications, map, reviews | `portfolio` is the sector's whole value proposition and holds **0 rows in production** |
| `healthcare` | `appointment` (`BookingPanel`) | booking panel, healthcare info, doctors, verifications, map, reviews | Team renders at position 19, below the service list; 2 rows in `doctors` total |
| `realEstate` | `catalog` + `LeadForm`, directory-only (`store-experience.ts:35-38`) | lead form, listings grid, map, reviews | No listing gallery on the profile; `listings` module has zero readers |
| `automotive` | `catalog` + `LeadForm`, directory-only | lead form, listings grid, map, reviews | Same; `rentals` is in its bundle (`sectors.ts:250`) and has zero readers |
| `beauty` | `appointment` | booking panel, team, goods cart, map, reviews | No before/after gallery — the single most persuasive artefact in this sector has no home |
| `fitness` | `catalog` (no `appointments` in bundle) + memberships + classes | memberships, classes, team, map, reviews | Class *schedule* renders but there is no timetable view; trainers render below everything |
| `sportsCourts` | `catalog` + timeslot booking | timeslot booking, memberships, map, reviews | Courts have no photos — `store_resources` (`page.tsx:219`) selects `name, price, open_hour, close_hour` and no image column exists |
| `education` | `catalog` + courses + memberships | courses, memberships, team, verifications, reviews | `location` is **not** in the bundle (`sectors.ts:305`), so a school renders no map |
| `events` | `catalog` + `EventTickets` | ticket purchase, catalog grid, map, reviews | Venue has no gallery; `event_ticket_types` holds 0 rows |
| `hospitality` | `catalog` + `StaySearch` | stay search, units-as-catalog, map, reviews | `accommodation_units.images` (jsonb) holds photos that the **profile never renders** — 4 units exist |
| `pharmacy` | `order` cart | cart, verifications, map, reviews | No `media` module at all (`sectors.ts:344`); no prescription-upload path |
| `petCare` | `appointment` | booking panel, team, goods cart, map, reviews | Same shape as beauty; no facility photos |
| `professional` | `appointment` + request form | booking panel, request form, team, verifications, reviews | No `location` and no `media` in bundle (`sectors.ts:370`); credentials are the product and get one generic card |
| `contractors` | `catalog` + request form + portfolio | request form, portfolio, catalog grid, verifications, map, reviews | `store_portfolio` = 0 rows; meanwhile `craft_works` implements the same idea separately for the crafts directory |
| `farm` | `order` cart | cart, couriers, map, reviews | No `messaging` in bundle (`sectors.ts:396`) — the only sector without it, apparently unintentionally |

---

## 5. Built vs unused vs missing — the distinction that matters

**Built and working:** module resolution, the experience resolver, the three transaction surfaces, verifications, hours, provider availability, delivery zones, branches, follow/share/message, JSON-LD, cover focal-point control (`store-hero.tsx:95` + `stores.cover_position`), client-side image downscaling (`image-upload.tsx:30-84`).

**Built but empty in production** — these need seeding and merchant prompting, not engineering:
- `store_portfolio` — 0 rows. Manager UI exists (`merchant/[storeId]/portfolio/page.tsx`, `components/portfolio-manager.tsx`), public component exists (`components/store-portfolio.tsx`), page query exists (`page.tsx:247-255`). The entire path is built and nobody has used it.
- `store_memberships` — 0 rows. `event_ticket_types` — 0 rows.
- `doctors` — 2 rows; `store_staff` — 1 row; `store_classes` — 1 row.
- Map coordinates — 3 of 11 stores.

**Built but not wired to the engine:** `reviews`, `messaging`, `delivery`, `orders` render without consulting their module flags; `team` consults the sector default and ignores the store override.

**Declared but never implemented:** `media`, `marketing`, `catalog`, `pos`, `rentals`, `listings` — six module keys with zero readers.

**Genuinely missing:** any store-level gallery table; any per-sector section ordering; any structured "information" region (policies, payment methods, languages spoken, accessibility, parking); price-band signalling; review depth (dates, replies, photos, verified-purchase); a shared offering contract across the six bespoke offering components.

---

## 6. What this means for the 2.0 spec

The work is not to build a profile engine. It is to:

1. **Give the engine an ordering axis.** `SectorConfig` needs a `profileSections: ProfileSectionKey[]` field alongside `features` and `modules` — see `05_SECTOR_PROFILE_MATRIX.md`.
2. **Close the six dead module keys**, starting with `media`, which 15 sectors already declare.
3. **Fix the four ungated renders and the one ignored override** (`team`) so "module off" means something everywhere.
4. **Remove the two remaining hardcoded slug checks** (`page.tsx:499-504`, `:699`) — they are the last survivors of the pattern `store-experience.ts:8-14` was written to kill.
5. **Fill what is built and empty** before building more. `store_portfolio` has a complete merchant UI and zero rows; that is a product/onboarding problem, and shipping a second gallery on top of it would make it worse.
