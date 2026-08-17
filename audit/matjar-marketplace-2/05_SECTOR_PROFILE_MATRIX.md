# 05 — Sector Profile Matrix

Recommended public-profile section order for **all 17 configured sectors**, read from `src/lib/catalog.ts:4-22` (`categoryKeys`) and `src/lib/sectors.ts:182-407` (`sectorConfig`). No sector is invented; no sector is omitted.

**Everything in this file is a RECOMMENDATION.** Today there is exactly one order, hardcoded as JSX sequence at `src/app/[lang]/(site)/store/[id]/page.tsx:542-722`, identical for all 17 sectors. `SectorConfig` (`sectors.ts:155-169`) has an ordering field for the **merchant OS** (`modules: Record<OsGroupKey, OsModuleKey[]>`) and none for the **public profile**. The proposal is to add `profileSections: ProfileSectionKey[]` alongside `features`.

---

## Section keys

| Key | Component today | Position in today's fixed order |
|---|---|---|
| `identity` | `store/store-hero.tsx` + `store/store-header.tsx` | 2–3 |
| `gallery` | — **does not exist** (`media` module has zero readers) | — |
| `primary_action` | one of `ServiceRequestForm` / `LeadForm` / `StaySearch` / `EventTickets` / `TimeslotBooking` / `ReservationForm` / `BookingPanel` | 7–14, 17 |
| `offerings` | `store/store-products-section.tsx` (+ `StoreCourses`, `StoreMemberships`, `ClassesBooking`) | 12, 15, 17 |
| `portfolio` | `components/store-portfolio.tsx` | 16 |
| `team` | `store/store-doctors.tsx` | 19 |
| `memberships` | `components/store-memberships.tsx` | 12 |
| `availability` | inside `store-header.tsx:119-157` | 3 |
| `locations` | `store/store-branches.tsx` + `StoreMapClient` | 4, 6 |
| `delivery` | `store/store-delivery-options.tsx` | 5 |
| `information` | `store/store-healthcare-info.tsx` (healthcare only, hardcoded `page.tsx:699`) | 18 |
| `verifications` | `components/store-verifications.tsx` | 20 |
| `reviews` | `components/store-reviews.tsx` | 21 |
| `offers` | — **does not exist** (`marketing` module has zero readers) | — |

`identity` is position 1 in every sector and is omitted from the lists below to keep the differences visible.

---

## The 17 sectors

Order given after `identity`. **Bold** marks a section whose position changes materially from today's fixed order. *Italic* marks a section with no implementation today.

### 1. `food` — `sectors.ts:183-195`
Features: `menu, orders, delivery, reservations, reviews, location, media, messaging`

`availability` → **`offerings` (menu)** → `primary_action` (reservation) → *`gallery`* → `delivery` → `locations` → `reviews` → `information`

**Why:** a hungry customer decides on the menu and whether you are open right now; today the menu is at position 17, below a courier list and a map.

### 2. `retail` — `sectors.ts:196-208`
Features: `catalog, orders, inventory, delivery, reviews, location, marketing, messaging, media`

**`offerings` (catalog)** → *`offers`* → `delivery` → `availability` → *`gallery`* → `locations` → `reviews` → `information`

**Why:** retail is chosen on stock and price, so the grid leads and promotions sit immediately under it — `marketing` is in this bundle and renders nothing today.

### 3. `services` — `sectors.ts:209-221`
Features: `requests, portfolio, reviews, verifications, location, messaging, media`

**`portfolio`** → `primary_action` (request form) → `offerings` → `verifications` → `reviews` → `locations` → `information`

**Why:** proof of work is the entire pitch for a service business, so the portfolio must precede the ask — and it currently holds **0 rows in production** despite a complete merchant UI.

### 4. `healthcare` — `sectors.ts:222-234`
Features: `appointments, team, verifications, reviews, location, messaging, media`

**`team`** → `availability` → `primary_action` + `offerings` (booking panel) → `verifications` → **`information`** (specialties, insurance) → `reviews` → `locations`

**Why:** patients choose a doctor, not a clinic; today the roster renders at position 19, beneath the service list and every commerce block.

### 5. `realEstate` — `sectors.ts:235-247`
Features: `listings, appointments, reviews, location, media, messaging`

**`offerings` (listings)** → `locations` → *`gallery`* → `primary_action` (lead form) → `team` → `reviews` → `information`

**Why:** property is chosen by browsing inventory and location, so the lead form belongs *after* the listing that prompted it, not above it as at `page.tsx:607`.

### 6. `automotive` — `sectors.ts:248-263`
Features: `listings, requests, rentals, reviews, location, media, messaging`

**`offerings` (listings)** → *`gallery`* → `primary_action` (lead form) → `verifications` → `reviews` → `locations` → `information`

**Why:** identical logic to real estate — the vehicle is the entry point and the test-drive request follows it.

### 7. `beauty` — `sectors.ts:264-276`
Features: `appointments, catalog, team, reviews, media, location, messaging`

**`team`** → *`gallery` (before/after)* → `availability` → `primary_action` + `offerings` (booking) → `reviews` → `locations` → `information`

**Why:** a salon is chosen on the stylist and on visible results, and the before/after image — the most persuasive artefact this sector has — currently has nowhere to live.

### 8. `fitness` — `sectors.ts:277-289`
Features: `memberships, classes, team, reviews, location, media, messaging`

**`memberships`** → **`offerings` (class timetable)** → `team` → *`gallery`* → `availability` → `reviews` → `locations` → `information`

**Why:** the decision is a recurring commitment, so price/plan leads and the timetable proves the plan is usable — `store_memberships` holds **0 rows** today.

### 9. `sportsCourts` — `sectors.ts:290-302`
Features: `timeslot, memberships, reviews, location, media, messaging`

**`primary_action` (slot picker)** → *`gallery` (courts)* → `memberships` → `locations` → `availability` → `reviews` → `information`

**Why:** the only question is "is a court free at 8pm", so the slot grid is the page — and court photos have no column anywhere (`store_resources` selects `name, price, open_hour, close_hour` at `page.tsx:219`).

### 10. `education` — `sectors.ts:303-315`
Features: `courses, team, memberships, reviews, verifications, messaging, media`

**`offerings` (courses)** → `team` (tutors) → `verifications` → `memberships` → **`information`** (accreditation, age range) → `reviews` → `locations`

**Why:** parents pick the programme first and the teacher second, and accreditation is a decision input rather than a footnote. Note `location` is **not** in this bundle, so a school renders no map today.

### 11. `events` — `sectors.ts:316-328`
Features: `timeslot, catalog, media, reviews, location, messaging`

*`gallery` (venue)* → **`primary_action` (tickets)** → `offerings` → `availability` → `locations` → `reviews` → `information`

**Why:** an event venue is bought on how it looks, so the gallery precedes the ticket box — `event_ticket_types` holds **0 rows** today.

### 12. `hospitality` — `sectors.ts:329-341`
Features: `timeslot, rentals, catalog, media, reviews, location, messaging`

*`gallery`* → **`primary_action` (stay search)** → **`offerings` (units)** → `locations` → **`information`** (check-in/out, cancellation) → `reviews` → `delivery`

**Why:** accommodation is chosen on photos then dates then policy — and `accommodation_units.images` (jsonb, `0191:36`) already holds unit photos the profile never renders.

### 13. `pharmacy` — `sectors.ts:342-354`
Features: `catalog, orders, verifications, location, reviews, messaging`

`availability` → **`offerings` (catalog)** → `verifications` → `delivery` → `locations` → `reviews` → `information`

**Why:** a pharmacy is chosen on "open now and can you deliver it", with the licence as reassurance rather than headline. This is one of two sectors with **no `media` module**, so no gallery is proposed.

### 14. `petCare` — `sectors.ts:355-367`
Features: `appointments, catalog, team, reviews, location, messaging, media`

**`team`** → `availability` → `primary_action` + `offerings` (booking) → *`gallery`* → `reviews` → `locations` → `information`

**Why:** the same trust-in-a-person logic as healthcare, applied to an owner handing over an animal.

### 15. `professional` — `sectors.ts:368-380`
Features: `appointments, requests, verifications, team, reviews, messaging`

**`verifications`** → **`team`** → `offerings` → `primary_action` (request / booking) → `reviews` → `information`

**Why:** a lawyer or accountant is bought on credentials before anything else, and this sector has **no `media` and no `location`** in its bundle — credentials are all it has to show.

### 16. `contractors` — `sectors.ts:381-393`
Features: `requests, portfolio, verifications, reviews, location, messaging, media`

**`portfolio`** → `verifications` → `primary_action` (request form) → `offerings` → `reviews` → `locations` → `information`

**Why:** past jobs plus a licence are the whole decision — and `store_portfolio` holds **0 rows** while `craft_works` (`0238:84-93`) implements the same idea separately for the crafts directory.

### 17. `farm` — `sectors.ts:394-406`
Features: `catalog, orders, delivery, reviews, location, media`

**`offerings` (catalog)** → `delivery` → `availability` → *`gallery`* → `locations` → `reviews` → `information`

**Why:** produce is bought on what is in season today and whether it reaches you — this is the only sector without `messaging` in its bundle, which looks unintentional.

---

## Patterns worth naming

**Four archetypes emerge, and they map onto `SectorConfig.customersNoun` (`sectors.ts:163`) more cleanly than onto the sector list:**

| Archetype | Leads with | Sectors |
|---|---|---|
| **Inventory-first** | `offerings` | `retail`, `pharmacy`, `farm`, `food`, `realEstate`, `automotive` |
| **Person-first** | `team` | `healthcare`, `beauty`, `petCare`, `professional` |
| **Proof-first** | `portfolio` / `gallery` | `services`, `contractors`, `events`, `hospitality` |
| **Commitment-first** | `memberships` / `primary_action` | `fitness`, `sportsCourts`, `education` |

This is a plausible default layer: `profileSections` could be defined per archetype and overridden per sector, which keeps 17 sector configs from drifting into 17 bespoke layouts.

**Three sections are recommended for a majority of sectors and do not exist at all:** `gallery` (13 of 17 above), `information` (17 of 17), `offers` (1 of 17 — `retail` only, matching the single sector carrying `marketing`).

**One recommendation is blocked by data, not code:** `locations` for `education` and `professional` — neither bundle contains `location` (`sectors.ts:305`, `:370`), and only 3 of 11 production stores carry coordinates at all.
