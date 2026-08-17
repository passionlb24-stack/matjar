# 04 — Business Profile Engine 2.0

**This is an evolution spec, not a greenfield design.** The engine exists (see `03_CURRENT_BUSINESS_PROFILE_AUDIT.md` §0). Each region below states what exists today with evidence, what is actually missing, and the module contract that should govern it.

**Contract vocabulary used below**

Every profile region should answer four questions the same way, so a new sector is configuration and not code:

```
ProfileSection = {
  key:            ProfileSectionKey       // stable id, used for ordering
  requires:       FeatureModuleKey[]      // ALL must be in resolveStoreModules()
  hasContent:     (data) => boolean       // renders only with real content
  sectorLabel:    (category, dict) => string   // sector vocabulary, no slug switches
  emptyBehaviour: "hide" | "merchant-prompt"
}
```

Three rules that today's code breaks and 2.0 must hold:

1. **A section renders iff `requires` is satisfied by the *resolved* set.** No section may read `sectorConfig[...].features` directly — that is the `team` bug (`src/lib/sectors.ts:438-440`, honoured at `page.tsx:272`, which makes the store-level override dead).
2. **No slug comparisons in the page.** Two survive: `page.tsx:499-504` (section heading) and `page.tsx:699` (healthcare info). `src/lib/store-experience.ts:8-14` documents why this pattern was banned.
3. **Order comes from the sector registry, not from JSX position.** Today the 21 sections are a fixed literal sequence (`page.tsx:542-722`) identical for all 17 sectors.

---

## Region 1 — Identity

**Exists.** `src/components/store/store-header.tsx:48-228`. Logo with category-icon fallback (`:52-62`), name (`:65-67`), Pro badge (`:73`), commercial-registration badge (`:75-79`), verified badge (`:80-85`), sector label (`:87`), rating chip (`:89-97`), fulfilled-count chip (`:98-106`), prep-time chip (`:107-112`), area chip (`:113-118`), live open/closed pill (`:119-157`), eight contact/social actions (`:162-218`), free-text description (`:221-225`).

Data source: `stores` columns selected at `src/lib/data/store-view.ts:111`.

**Missing.**
- No tagline / one-line "what we do". `description` is a single untyped text column with no Arabic/English split — `StoreView` carries `descriptionEn` for products (`store-view.ts:65`) but nothing equivalent for the store.
- The label under the name is the *sector* ("Healthcare"), never the specialisation ("pediatric clinic", "Italian, wood-fired"). `stores.specialties` exists but is healthcare-gated at `page.tsx:699`.
- No established-year, no team size, no languages spoken, no `customersNoun` usage on the public side — `SectorConfig.customersNoun` (`sectors.ts:163`) drives OS vocabulary only.
- Action hierarchy is flat: eight equal buttons, and the sector's real conversion action is not among them.

**Contract.**
```
identity: { key:"identity", requires:[], hasContent:()=>true, emptyBehaviour:"merchant-prompt" }
```
Always first, never optional. Add `stores.tagline`, `stores.tagline_en`, `stores.established_year`; promote `specialties` to a sector-neutral `specialisation` rendered under the name for every sector via `dict.catalog[category].specialisationLabel`. Introduce a `primaryAction` derived from `resolveStoreExperience()` (`store-experience.ts:111`) and render it in the header, with the eight existing buttons demoted to a secondary row.

---

## Region 2 — Cover & gallery

**Exists, partially.** Cover: `store-hero.tsx:15-108`, four theme variants (`:32-37`), merchant-controlled vertical focal point via `stores.cover_position` (`:95`), 3:1 banner (`:46`) with the reasoning recorded at `:39-45`. Logo: `store-header.tsx:52-62`.

**Missing — and this is the largest single gap in the engine.**

There is **no store-level gallery**. No table, no component, no route. Grep of every consumer of the module registry confirms `media` — declared at `modules-catalog.ts:43,85` and present in **15 of 17 sector bundles** (all but `pharmacy` `sectors.ts:344` and `professional` `:370`) — has **zero readers anywhere in `src/`**. A merchant can toggle it off and nothing changes.

Meanwhile image storage is scattered across six unconnected shapes:

| Shape | Location | Owner |
|---|---|---|
| `stores.logo_url`, `stores.cover_url` | `migrations/0003_stores_and_business_types.sql:31-32` | store |
| `products.image_url` + `products.gallery jsonb` | `0005_products.sql:12`, `0021_product_depth.sql:4` | product |
| `store_portfolio.image_url` (rows) | `0133_store_portfolio.sql:12` | store |
| `accommodation_units.images jsonb` | `0191_accommodation_engine.sql:36` | unit |
| `listings.gallery jsonb`, `gigs.gallery jsonb` | `0204_listing_depth.sql:12,33` | listing/gig |
| `craft_works.image_url` (rows) | `0238_craft_providers_standalone.sql:88` | craft provider |

Two of these — `store_portfolio` and `craft_works` — are the *same idea* implemented twice, and `0238:84` even names it: "Past jobs with photos. Not a digital portfolio — a record of work done."

Full treatment in `10_GALLERY_PORTFOLIO.md`.

**Contract.**
```
cover:   { key:"cover",   requires:["media"], hasContent:s=>!!s.coverUrl, emptyBehaviour:"merchant-prompt" }
gallery: { key:"gallery", requires:["media"], hasContent:g=>g.length>0,   emptyBehaviour:"hide" }
```
Note that gating cover on `media` would today hide the cover for `pharmacy` and `professional`. Either add `media` to those two bundles or leave cover un-gated and gate only the gallery — the second is safer and is what §Recommendations proposes.

---

## Region 3 — Offerings

**Exists, and it is the best-engineered part of the platform.** `src/components/store/store-products-section.tsx:22-359` branches on `experience.itemSurface` (`store-experience.ts:22-25`):
- `appointment` → `BookingPanel` over `item_kind='service'` rows with provider picker, duration, buffer, capacity (`:95-130`)
- `order` → `StoreProducts` cart with variants, bundles, flash pricing, zones, loyalty, branches (`:131-181`)
- `catalog` → browse-only grid + contact CTA (`:182-259`)

And a store can render both surfaces at once — `showGoodsSection` (`:86-87`) gives a clinic a cart for supplements under its booking engine. The `item_kind` split that enabled this is documented at `:77-80`.

Around it sit six further offering components, each a separate top-level section: `StoreCourses` (`page.tsx:665`), `StoreMemberships` (`:641`), `ClassesBooking` (`:650`), `EventTickets` (`:624`), `StaySearch` (`:618`), `TimeslotBooking` (`:630`).

**Missing.**
- **No shared offering contract.** Seven components, seven prop shapes, seven visual treatments, stacked in fixed order. A sector cannot choose which is primary.
- **The heading is a slug switch** (`page.tsx:499-504`). Twelve of 17 sectors fall through to the generic "products" label — including `hospitality` (whose offerings are rooms), `events` (tickets), `fitness` (classes and plans) and `education` (courses).
- **No price signalling above the offering list.** No "from $X", no price band. `craft_services.pricing_type` (`0238:78-79`) already models the five real pricing shapes (`fixed|from|hourly|per_meter|quote`) — none of that vocabulary reached the store side.
- `experience.canOrderProducts` is a flat `true` for every non-directory sector (`store-experience.ts:183`) — it never consults the `orders` module.

**Contract.**
```
offerings: {
  key:"offerings",
  requires:[],                 // at least one of catalog|menu|listings|courses|memberships|...
  variants: OfferingVariantKey[],   // sector-ordered: which engine is primary
  sectorLabel: (cat,dict) => dict.catalog[cat].offeringsLabel,
  hasContent: d => d.items.length>0
}
```
Add `offeringsLabel` per sector to the dictionary and delete the switch at `page.tsx:499-504`. Make `canOrderProducts` read `enabledModules.has("orders")`.

---

## Region 4 — Portfolio and the image→offering→CTA concept

**The brief's concept:** an image of past work, which names the offering that produced it, which carries a CTA to buy/book that offering.

**Does `store_portfolio` support it? Read the schema — partially, and the missing half is the important half.**

`supabase/migrations/0133_store_portfolio.sql:6-16`:
```sql
create table public.store_portfolio (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  title       text not null,
  title_en    text,
  description text,
  image_url   text,
  link        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
```

- **image** — yes, `image_url` (single, nullable).
- **offering** — **no**. There is no `product_id`. `link` is a free-text external URL, rendered as `target="_blank" rel="noopener noreferrer"` at `components/store-portfolio.tsx:65` — it sends the customer *off the platform*, which is the opposite of the concept.
- **CTA** — **no**. The card's only action is that outbound link. There is no book/order/request path from a portfolio item.
- Also absent: `provider_id` (who did the work), `completed_on`, before/after pairing, multiple images per item, `alt_text`, moderation status.

So the answer is: `store_portfolio` supports **image → external link**. It does not support **image → offering → CTA**. The gap is one nullable FK and one CTA renderer.

**Also relevant:** the table holds **0 rows in production** while the merchant UI (`merchant/[storeId]/portfolio/page.tsx`, `components/portfolio-manager.tsx:19-116`) and the public component (`components/store-portfolio.tsx:16-77`) are both complete and the page query is live (`page.tsx:247-255`). This is *built and unused*, not missing. Building a second portfolio surface before understanding why zero merchants used the first would be a mistake.

**Contract.**
```
portfolio: {
  key:"portfolio",
  requires:["portfolio"],
  hasContent: items => items.length>0,
  emptyBehaviour:"merchant-prompt"   // for services/contractors, where it is the value prop
}
```
Schema additions to make the brief's concept work, in order of value:
1. `store_portfolio.product_id uuid references products(id) on delete set null` — the offering link. CTA then reuses whatever surface `resolveStoreExperience` already chose, so no new transaction code.
2. `store_portfolio.alt_text text` and `alt_text_en text`.
3. `store_portfolio.provider_id uuid references doctors(id) on delete set null` — attaches work to a practitioner (see `11_TEAM_PROFILES.md`).
4. `store_portfolio.completed_on date`, `store_portfolio.kind text check (kind in ('work','before_after','venue','offering'))`.
5. A `store_portfolio_images` child table, or `images jsonb`, for multi-image and before/after pairs.

`link` should be kept but demoted below the on-platform CTA.

---

## Region 5 — Team

**Exists, deeper than expected.** `doctors` table (`0026_healthcare_doctors.sql:4-14`) is already the **generic provider table** — `0146_service_providers_join.sql:1-5` states it explicitly: "generalizes the clinic 'doctor' idea to every service sector (stylist, technician, trainer, teacher…)". It carries per-provider availability (`provider_availability_rules`, `provider_availability_exceptions`, read at `merchant/[storeId]/doctors/page.tsx:97-111`) and a many-to-many service assignment (`service_providers`, `0146:6-12`).

Public render: `page.tsx:268-291` fetches, `page.tsx:704` renders `store/store-doctors.tsx:13-63` — photo, name, specialty, bio.

**Missing.** Position 19 of 21, below the entire offering list, for `healthcare` and `beauty` where the practitioner *is* the choice. No credentials, no per-provider reviews, no languages, no years of experience, no per-provider booking CTA on the card (the picker lives inside `BookingPanel`). The table is named `doctors` in every sector. `sectorHasTeam()` ignores the store override. `alt=""` on every provider photo (`store-doctors.tsx:34`).

Full treatment in `11_TEAM_PROFILES.md`.

**Contract.**
```
team: { key:"team", requires:["team"], hasContent: p => p.length>0, emptyBehaviour:"hide" }
```
Must use `resolveStoreModules(...).has("team")`, not `sectorHasTeam()`.

---

## Region 6 — Availability

**Exists, and is correct.** `store-header.tsx:119-157` parses the structured `hours` grid, reads the clock once server-side, renders a live open/closed pill plus today's span. The comment at `:68-72` records the removal of a pill that had been reading platform-approval status. Provider-level rules and exceptions exist per §5. Booking windows: `stores.booking_slot_minutes`, `booking_cancel_hours` (`store-view.ts:34,36`).

**Missing.** Today only — no week view, no upcoming holiday/closure notice. **No "next available" signal on the profile**: the earliest free slot is computed inside `BookingPanel` and never surfaced above the fold, which is the single highest-value availability fact for every booking sector. Branches carry `phone` but no hours (`page.tsx:451`), so a multi-branch store publishes one schedule for all locations. No response-time signal for `requests`/`leads` sectors — a quote request goes into a void.

**Contract.**
```
availability: {
  key:"availability",
  requires:[],  // rendered inside identity today; promote to its own region for booking sectors
  hasContent: s => parseHours(s.hours) != null
}
```
Add `store_locations.hours jsonb`. Add a `nextAvailable` value computed once server-side and passed to identity for booking sectors.

---

## Region 7 — Reviews

**Exists, shallow.** `reviews` table (`0009_reviews.sql:2-13`): `rating`, `comment`, `customer_name`, `created_at`, unique per `(store_id, customer_id)`. Rendered at `page.tsx:714` by `components/store-reviews.tsx:15-...`. Aggregate computed at `page.tsx:311-315` and shown in the header chip.

**Missing.** No date on screen. No merchant reply. No verified-purchase marker — despite `store_fulfilled_count` already proving the store transacts (`page.tsx:305`). No photos, no sort, no filter, no rating-distribution bar, no helpful-vote, no report path. **Not module-gated** — renders on `store.isReal` alone, so switching `reviews` off does nothing. Production holds **5 rows across 11 stores**, and `product_reviews` (1 row) and `craft_reviews` are separate tables that never surface on the store profile.

**Contract.**
```
reviews: { key:"reviews", requires:["reviews"], hasContent:()=>true, emptyBehaviour:"merchant-prompt" }
```
Schema: `reviews.merchant_reply text`, `merchant_replied_at timestamptz`, `order_id uuid references orders(id)` (nullable — presence renders "verified purchase"), `photos jsonb`. Surface `created_at`, which is already stored and simply not rendered.

---

## Region 8 — Information

**Barely exists.** The only structured information region is `store/store-healthcare-info.tsx:4-31`, gated on the hardcoded slug `store.category === "healthcare"` (`page.tsx:699`), rendering two free-text columns: `stores.specialties` and `stores.insurance`.

Everything else a customer needs to decide is either free-text inside `description`, or absent: payment methods (`stores.payment_note` exists at `store-view.ts:46` and is passed only into the cart, never shown on the profile), cancellation policy (exists per accommodation unit at `0191:34`, nowhere else), min-order and delivery terms (in the cart only), languages, parking, accessibility, age policy, licences beyond the verification cards.

**Missing.** A sector-shaped key/value information block. This is the cheapest high-value addition in the whole spec: the data mostly exists and is not rendered.

**Contract.**
```
information: {
  key:"information",
  requires:[],
  fields: InformationFieldKey[],   // per sector, from the registry
  hasContent: f => f.some(v => v != null)
}
```
Replace `StoreHealthcareInfo` with a generic `StoreInformation` driven by a `SectorConfig.infoFields` list. `healthcare` gets `["specialties","insurance"]` and the hardcoded check at `page.tsx:699` dies; `hospitality` gets `["checkIn","checkOut","cancellation"]`; `education` gets `["accreditation","ageRange"]`; every sector gets `["paymentMethods","languages"]`.

---

## Region 9 — Commercial modules

**Exists, ungated.**
- **Delivery** — `store_couriers` → `store/store-delivery-options.tsx` (`page.tsx:580`); `store_delivery_zones` with fee / min / free-over / ETA (`page.tsx:398-418`). Neither consults `enabledModules.has("delivery")`.
- **Loyalty** — `stores.loyalty_redemption_enabled`, `loyalty_points_per_unit`, `my_loyalty_by_store` RPC (`page.tsx:477-484`). Visible only inside checkout, never on the profile.
- **Coupons / campaigns** — merchant routes exist (`merchant/[storeId]/coupons`, `/campaigns`); the `marketing` module has **zero readers** and no public surface.
- **Memberships** — `StoreMemberships` (`page.tsx:641`), plans table populated, `store_memberships` holds **0 rows**.
- **Branches** — `store_locations` → `store/store-branches.tsx`, gated on `> 1` (`page.tsx:576`).

**Missing.** No public offers/promotions strip despite `marketing` being declared for `retail` (`sectors.ts:198`). Loyalty is invisible until checkout, so it cannot influence the choice of store. Delivery terms (min order, free-over threshold, ETA) are fetched at `page.tsx:399-407` and shown only in the cart — a customer comparing 11 stores cannot see them.

**Contract.**
```
delivery:   { key:"delivery",   requires:["delivery"],   hasContent:d=>d.zones.length>0||d.couriers.length>0 }
offers:     { key:"offers",     requires:["marketing"],  hasContent:o=>o.length>0 }
memberships:{ key:"memberships",requires:["memberships"],hasContent:p=>p.length>0 }
locations:  { key:"locations",  requires:["location"],   hasContent:b=>b.length>1||b.hasPin }
```

---

## Cross-cutting: what 2.0 must fix in the engine itself

| # | Fix | Evidence | Why it matters |
|---|---|---|---|
| 1 | Add `SectorConfig.profileSections: ProfileSectionKey[]` | `sectors.ts:155-169` has no ordering field for the public page | Order is the difference between a clinic that leads with its doctors and one that buries them at position 19 |
| 2 | `team` must read the resolved set | `sectors.ts:438-440`, `page.tsx:272` | The store-level override is currently dead for this one module |
| 3 | Gate `reviews`, `messaging`, `delivery`, `orders` | `page.tsx:714`, `store-header.tsx:181`, `page.tsx:580`, `store-experience.ts:183` | "Module off" must mean the same thing everywhere or merchants stop trusting the toggles |
| 4 | Delete the two slug switches | `page.tsx:499-504`, `page.tsx:699` | Last survivors of the pattern `store-experience.ts:8-14` was written to eliminate |
| 5 | Implement `media`, or remove it | `modules-catalog.ts:43`, 15 sector bundles, zero readers | A toggle that does nothing is worse than an absent one |
| 6 | Let merchants *add* modules, not only remove | `merchant/[storeId]/modules/page.tsx:68` builds from `sectorDefaultModules` only | `store_modules` already supports it; only the UI subtracts |
| 7 | Correct the aspirational comment | `modules-catalog.ts:5-8` claims four surfaces render from the enabled set; only the public profile does | Documentation that overstates reach hides the gap |

---

## Sequencing

**Phase A — make the existing engine honest.** Fixes 2, 3, 4, 7 above. No schema. No new UI. This is a day of work and it makes every later module contract trustworthy.

**Phase B — ordering.** Fix 1: add `profileSections` to `SectorConfig`, render the page from it. The 21 sections already exist as components; this is a re-wiring, not a rewrite. Delivers the per-sector profile the brief is asking for, using what is already built.

**Phase C — `media`.** One store-level gallery table, one component, gated on the module 15 sectors already declare. See `10_GALLERY_PORTFOLIO.md`.

**Phase D — depth.** Portfolio `product_id` + CTA; review dates/replies/verified-purchase; generic `information` region; `next available`.

**Phase E — consolidation.** The parallel implementations (`store_portfolio` vs `craft_works`; `doctors` vs `craft_providers`; six jsonb gallery shapes). Deliberately last: these are live tables with real rows and the migration cost is real. See `11_TEAM_PROFILES.md` for that costing.
