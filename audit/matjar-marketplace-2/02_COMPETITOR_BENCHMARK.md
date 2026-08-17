# 02 — Competitor Benchmark (Principles Only)

**Scope and honesty statement.** Everything below is drawn from my product knowledge of how these
categories of marketplace work — not from live inspection of any competitor's site, app, API or
internals during this audit. I did not browse Fresha, Booksy, Zocdoc, Airbnb, DoorDash, Talabat,
Eventbrite, Amazon, Noon, or any real-estate/automotive portal while writing this. Where I state a
principle, treat it as a well-established pattern in that category, not as a claim about a specific
company's current implementation. **I have deliberately reproduced no branding, colours, layouts,
wording, or copy.** Nothing here is a design spec.

Everything said about **Matjar** is verified against this repository and the production database, and
is cited.

**How to read the verdict column:**

| Verdict | Meaning |
|---|---|
| **Have** | Built and reachable by a real user today. |
| **Partial** | Primitive exists; incomplete, un-surfaced, or store-local instead of platform-wide. |
| **Missing** | No code or schema found. |
| **Deliberately deferred** | Absent by an explicit, documented decision in the codebase. |

---

## A. Appointment marketplaces (Fresha / Booksy class)

### A1. The sellable unit is `service × provider × time`, and availability *is* the inventory

**Why it works.** A salon has no stock. The only scarce thing is a named person's diary. Modelling
the offer as "a service" and the booking as "a slot on a provider" makes double-booking structurally
impossible and lets the same service have different durations and prices per provider.

**Matjar: Have.** `products.item_kind` splits bookable services from physical goods
(`src/lib/store-experience.ts:75-79` documents exactly this: before `item_kind`, "enabling
appointments turned every row into a bookable service and the cart vanished"). Providers are the
`doctors` table joined to services through `service_providers`
(`src/app/[lang]/(site)/store/[id]/page.tsx:272-291`), and `sectorHasTeam()`
(`src/lib/sectors.ts:438-440`) decides which sectors get a provider roster at all. Overlap is
prevented in the database, not the UI — `0174_booking_engine.sql` uses `btree_gist` exclusion
constraints (lines 15, 75, 82).

**Gap: none material.** This is one of the strongest parts of the platform.

### A2. Marketplace discovery is availability-first

**Why it works.** In this category the query is not "show me salons", it is "who can cut my hair at
6pm tomorrow near me". Results that carry live slots convert; results that carry a phone number do
not. This is the single highest-leverage difference between a directory and a booking marketplace.

**Matjar: Missing.** `/explore` accepts exactly three parameters — `q`, `region`, `group`
(`src/app/[lang]/(site)/explore/page.tsx:32`). There is no date, no time, no availability, no
service-type facet. The booking engine is reachable only *after* the buyer has already chosen a
specific store and opened its page. No search surface anywhere in the app queries the booking tables.

**Gap: the largest single discovery gap in the product.** Matjar has a real booking engine that the
marketplace layer cannot see.

### A3. No-show economics — deposits, card-on-file, cancellation windows

**Why it works.** Appointment businesses are destroyed by no-shows. A deposit converts a free option
into a priced commitment, and it is usually the reason merchants tolerate a platform's commission.

**Matjar: Missing.** No deposit, pre-authorisation, or cancellation-policy field exists on the
booking path. The prior vertical audit already identified this — `04_VERTICAL_CAPABILITY_MATRIX.csv`
lists "deposit" as a beauty-sector gap.

**Gap: real, but correctly sequenced behind payments.** Matjar has no online payment rail at all
(the platform is cash/WhatsApp-first by explicit strategy — `docs/PRODUCT_STRATEGY.md` §0, principle
2). A deposit without a payment rail is not implementable.

### A4. The merchant calendar is the system of record

**Why it works.** A merchant who runs their day out of your calendar cannot leave. Discovery is
rented; the operational system of record is owned.

**Matjar: Have, and over-delivers.** This is what the whole `merchant/[storeId]/*` tree is —
35 OS modules (`OsModuleKey`, `src/lib/sectors.ts:60-95`) covering POS, inventory, accounting, HR,
attendance, automations, suppliers and kitchen display. This is far beyond what appointment
marketplaces typically ship.

---

## B. Healthcare marketplaces (Zocdoc class)

### B1. Insurance is a first-class filter, because it is the actual buying constraint

**Why it works.** A patient's real query is "a dermatologist who takes my insurance". Rank order is
irrelevant if the top result does not accept their plan.

**Matjar: Partial.** Insurance data exists on the store record and renders on the storefront
(`StoreHealthcareInfo`, gated at `src/app/[lang]/(site)/store/[id]/page.tsx:699-702`). It is a
free-text display field, not a controlled vocabulary, and it is **not a filter anywhere** — `/explore`
and `/search` never reference it.

**Gap: the field exists, the facet does not.** Same shape as the attribute gap in §F1.

### B2. Credentials are verified by the platform, not self-asserted

**Why it works.** In regulated verticals the platform's core value is that it checked. Self-asserted
credentials transfer no trust.

**Matjar: Have.** `store_verifications` with an admin review queue
(`/admin/verifications`), an earned badge that only appears when a document reaches `verified`
(`store/[id]/page.tsx:203`), and a deliberate security decision to never send `doc_url` to the
browser (`store/[id]/page.tsx:179-183`). The `verifications` feature module is on by default for
healthcare, professional, contractors, education and pharmacy (`src/lib/sectors.ts`).

**Gap: none material.** This is well done and is a genuine differentiator.

### B3. The patient is not always the account holder

**Why it works.** Parents book for children, adults book for elderly relatives. Forcing
account ≡ patient loses a large share of real bookings.

**Matjar: Missing.** The booking contact is prefilled from the signed-in user's own profile
(`store/[id]/page.tsx:318-336`). There is no patient/dependant record.

**Gap: real but small at current volume** (22 bookings total across 6 stores).

---

## C. Stays (Airbnb class)

### C1. The primary query is date-range + guests; the price shown is the total for the stay

**Why it works.** Per-night prices are not comparable once cleaning fees, minimum stays and
seasonality exist. Showing a stay total is what makes results honest and comparable.

**Matjar: Partial.** The date-range engine exists — `accommodation_units`, `search_stay` RPC
(`0191_accommodation_engine.sql:114`), `stay_bookings`, and a `StaySearch` component gated on
`experience.showStay` (`store-experience.ts:120-133`). **But `search_stay` takes a `p_store_id`** — it
is an availability checker inside one hotel's page, not a discovery surface
(`src/components/stay-search.tsx:63`). There is no way to ask "any chalet in the North, 14–16 Aug,
4 guests".

**Gap: the engine is built and the marketplace cannot query it.** Identical structural failure to
A2. Note also there are **zero active hospitality stores** in production, so nothing is currently
lost by this.

### C2. Rate plans — seasonality, minimum stay, weekend pricing

**Why it works.** Accommodation revenue is a yield-management problem. A single flat nightly price
leaves most of the margin on the table and merchants know it.

**Matjar: Missing.** The prior capability matrix names `rate_plans` as the needed engine for both
`sportsCourts` and `hospitality` and it is not built.

**Gap: real, correctly deferred.** Zero hospitality tenants.

### C3. Two-sided reviews with double-blind release

**Why it works.** If the host sees the guest's review before writing their own, both sides write
strategically and ratings compress toward 5 stars. Double-blind release is what keeps the signal.

**Matjar: Missing.** Reviews are one-directional customer→store
(`store/[id]/page.tsx:168-173`). There is no merchant→customer review and no blind-release window.

**Gap: real, but 5 reviews exist in production.** Rating integrity is not yet a live problem.

### C4. The platform holds the money and releases it after fulfilment

**Why it works.** Escrow is the mechanism that lets strangers transact. It is the substitute for a
prior relationship, and it is why marketplaces can charge a take rate at all.

**Matjar: Deliberately deferred.** Cash-on-delivery and WhatsApp are the explicit model
(`docs/PRODUCT_STRATEGY.md` §0). There is no payment processing anywhere in the codebase.

**Gap: this is the strategic fork in the road.** See `30_FINAL_RECOMMENDATIONS.md` §3. Without
escrow Matjar cannot take a transaction fee, which caps it at a SaaS subscription business — which is
in fact what `plan-tiers.ts` builds ($10/$25/$65 per month). That is a coherent choice, not an
oversight, but it should be a conscious one.

---

## D. Food delivery (DoorDash / Talabat class)

### D1. Discovery starts from the delivery address, not from a category

**Why it works.** A restaurant that cannot deliver to you is not a result, it is noise. Address-first
filtering is the entire information architecture of this category.

**Matjar: Missing.** `/explore` filters by administrative `region` only
(`explore/page.tsx:43-45`). Delivery zones exist per store (`store_delivery_zones`, migration 0172,
read at `store/[id]/page.tsx:398-418`) with fees, minimums and ETAs — but they are consumed only at
checkout inside one store. Nothing filters the store list by "delivers to me".

**Gap: real. The data exists one layer below where discovery needs it.** This is the third instance
of the same pattern.

### D2. Live ETA as the product

**Why it works.** In food delivery the promise being sold is time. An accurate, updating ETA is the
thing customers actually pay a fee for.

**Matjar: Partial.** `eta_min_minutes` / `eta_max_minutes` are static per delivery zone. There is
order status tracking (`order_status_events`, `/track/[orderId]`) but no courier position, no
prep-time model, and no live estimate.

**Gap: real, and correctly deferred.** With 7 orders in production, courier tracking is not the
constraint.

### D3. Modifier groups are the atomic menu unit

**Why it works.** "Choose your size (required, pick 1); add extras (optional, pick many)" is not a
presentation detail — it is what makes a food catalog priceable and a kitchen ticket executable.

**Matjar: Partial.** Add-ons and variants exist (`simplifiedItem: false` for food/retail/pharmacy/
farm, `src/lib/modules.ts:19-20`) and feed the order maths (`src/lib/order-math.ts:11`). What is
missing is *required* option groups with min/max selection rules — the prior matrix flags exactly
this: "required modifier groups + item note + scheduled orders", triggered by "first restaurant that
needs modifiers".

**Gap: real, correctly sequenced.** One active food store.

### D4. Reorder is the retention engine

**Why it works.** Food is the highest-frequency category in commerce. One tap to repeat the last
order is the single highest-ROI retention feature in the vertical.

**Matjar: Have.** `src/components/reorder-button.tsx` re-adds a past order's items to the store's
persisted cart and opens the store, rendered on the order detail page
(`src/app/[lang]/(site)/orders/[id]/page.tsx:159`).

**Gap: none.** *(I initially recorded this as missing and was wrong — the check that corrected it is
`grep -rni "reorder" src/`. Noted here because it is a reminder that this codebase repeatedly
contains more than a first pass suggests, which is the theme of this entire audit.)*

---

## E. Ticketed events (Eventbrite class)

### E1. The sellable unit is a ticket *type* with capacity and a sales window

**Why it works.** Event inventory is capacity that expires at a fixed instant, not stock that
persists. Early-bird/general/VIP tiers with their own windows are how events price discriminate.

**Matjar: Have (schema), unused (reality).** `event_ticket_types` and `event_tickets` exist
(migration 0193), the sector resolver routes `events` to the ticket surface
(`store-experience.ts:135-148`), `sectorPrimarySetup()` tells an events merchant to create ticket
types first (`src/lib/sectors.ts:430-431`), and `EventTickets` renders on the storefront. **Both
tables have zero rows and there are zero active events stores.**

**Gap: not a capability gap — a demand gap.** This is the clearest example of the platform's real
problem.

### E2. The attendee is not the purchaser, and check-in closes the loop

**Why it works.** One buyer purchases six tickets for six named people. Per-attendee identity plus
door scanning is what makes the ticket a real credential rather than a receipt.

**Matjar: Not verified.** I did not read the `event_tickets` column list. The prior matrix lists
"attendee" as part of the needed engine, implying it was scoped. QR generation exists in the merchant
tools (`src/components/hub/qr-generator.tsx`) but I found no ticket-scanning flow.

---

## F. Retail marketplaces (Amazon / Noon class)

### F1. Facets are computed from structured attributes, not authored per seller

**Why it works.** Faceted navigation is the core of large-catalog retail. It only works if attributes
are a platform-owned controlled vocabulary — otherwise every seller invents their own values and no
facet can be computed.

**Matjar: Partial, and this is the most important architectural finding in this document.**
`src/lib/attributes.ts` is a proper controlled vocabulary — typed fields with bilingual labels,
enumerated options, and an explicit `filter?: boolean` flag marking which are buyer-facing
(`attributes.ts:16-17`). It covers 4 of 17 sectors: `services`, `healthcare`, `realEstate`,
`automotive` (`attributes.ts:23-111`).

The filtering is implemented — **inside a single store's product grid**, in the browser, with exact
string equality (`src/components/store-products.tsx:279-281, 829-833`). Attributes are absent from
`/explore`, from `/search` and `searchAll`, from `/market`'s `ListingFilters`, and from the
`search_products_fuzzy` RPC, which does not even select an attributes column
(`0114_search_products_fuzzy.sql:37-64`).

**Gap:** the vocabulary is right; the query layer is one level too low. A buyer cannot ask
"3-bedroom apartment in Beirut" across the platform — they must first find a specific agency, enter
it, then filter within its own listings.

### F2. Ranking is a function of conversion; paid placement is disclosed

**Why it works.** Recency ordering degrades as soon as supply grows, because newest ≠ best. Learned
ranking is what keeps a large catalog usable. Disclosure of paid slots is what keeps it trusted.

**Matjar: Missing.** Every listing surface is recency-ordered with a paid float on top —
`fetchActiveStores` orders `created_at desc` then floats `featured`
(`src/lib/data/stores.ts:83-90`); `searchStores` has **no `.order()` at all**
(`stores.ts:178-199`); `getActiveListings` orders by `is_featured desc` then date or price and
applies **no relevance ordering even when a search term is present** (`src/lib/data/market.ts:230-243`);
`getSimilarProducts` defines "similar" as *same business type, different store, newest*
(`src/lib/data/related.ts:111`).

Paid placement is applied at four independent points (`stores.ts:90`, `stores.ts:221`,
`market.ts:230`, `0098_recommended_stores.sql:89`) and is **not labelled** in the UI.

The two genuine signals that do exist are unused by ranking: `get_best_sellers` feeds a homepage
strip only (`src/lib/data/best-sellers.ts:24`), and `bought_together` — real co-purchase
collaborative filtering (`src/lib/data/related.ts:41-59`) — feeds only a product-page module.

**Gap: real, but NOT yet worth solving.** With 65 products across 19 stores, recency ordering is
indistinguishable from perfect ranking. What *is* worth fixing now is the undisclosed paid
placement, which is a trust and possibly a regulatory issue at any volume.

### F3. Buyer protection is platform-level and uniform

**Why it works.** A marketplace promise must not vary by seller, or the buyer has to evaluate each
seller separately and the marketplace adds nothing.

**Matjar: Missing.** There is a `/trust` page and a verification badge system, but no returns
policy, dispute flow, or refund mechanism in the schema.

**Gap: real, and coupled to C4.** Without holding the money, Matjar cannot enforce a refund. This is
the same fork.

### F4. Shared catalog, competing sellers (the multi-offer product page)

**Why it works.** One canonical product page with several sellers' offers concentrates all demand
signal and reviews on one URL and turns sellers into price competitors.

**Matjar: Missing, and this may be correct forever.** Matjar's product model is store-owned
(`products.store_id`); there is no canonical catalog. For a market of independent local merchants
selling non-identical goods and services, a shared catalog is likely the wrong model. **I would not
build this.** See `30_FINAL_RECOMMENDATIONS.md` §5.

---

## G. Real-estate portals (Property Finder / Bayut / Zillow class)

### G1. The listing is the atom of discovery, not the agency

**Why it works.** Nobody shops for an estate agent. They shop for a home and tolerate the agent.
A portal whose search returns agencies has inverted its own product.

**Matjar: Missing for stores; Partial via a separate silo.** The store-based real-estate path is
agency-first: a buyer must find the agency's store page and browse its listings. There *is* a
listing-first surface — `/market` ("Sunday Market", migration 0036) with a genuine `listings` table,
price-range filters, pagination and sorting (`src/lib/data/market.ts:178-245`) — but it is a
**separate classifieds vertical, not connected to the sector/store system**. The `realEstate` sector
has one store, not active.

**Gap: architectural.** Matjar has two unconnected models of the same idea. See
`27_IMPLEMENTATION_ARCHITECTURE.md` §5.

### G2. Search is attribute-driven plus map/polygon

**Why it works.** Location in property is not administrative — it is "this neighbourhood, within
this boundary, near this school". Region dropdowns do not express it.

**Matjar: Missing.** There is **no spatial extension in the database at all** — no PostGIS, no
earthdistance, no geography column. The only lat/lng index is a plain composite btree
(`0084_store_locations.sql:26`), useless for radius search. Distance is computed in the browser with
Haversine (`src/lib/geo.ts:3-18`) over whatever slice of the store list is in memory, capped at
`STORE_FETCH_LIMIT = 200` (`src/lib/data/stores.ts:68`). `/map` has zero filters and no
viewport-bounded query — it is a static pin dump.

**Gap: real and structural.** But note only 3 of the active stores have coordinates at all, so the
data to index does not yet exist.

### G3. Lead quality is the monetised asset

**Why it works.** Portals in this category sell qualified leads and listing prominence, not
storefronts. The lead, with its provenance and its response time, is the product.

**Matjar: Partial — and this is a genuinely good piece of work.** `create_lead` RPC (migration 0190),
a `leads` table, a merchant `leads` inbox, `lead_status_control`, and typed lead kinds per sector —
`viewing / contact / offer` for real estate, `test_drive / contact / offer` for automotive
(`src/lib/store-experience.ts:60-64`). The resolver deliberately suppresses the generic
service-request form for lead sectors so inquiries do not split across two merchant inboxes
(`store-experience.ts:155-159`).

**Gap:** no response-time SLA, no lead scoring, no lead-based monetisation. 3 leads exist in
production.

### G4. Listing freshness and duplicate detection are editorial functions

**Why it works.** Stale and duplicated listings are what kill trust in property portals. Expiry
dates and dedupe are not nice-to-haves; they are the moderation product.

**Matjar: Missing.** No listing expiry, no staleness signal, no duplicate detection. There is an
admin moderation surface (`/admin/reviews`, `/admin/questions`, `admin-moderation-client.tsx`) but it
does not cover listing hygiene.

**Gap: real, defer.** 9 listings exist.

---

## H. Automotive marketplaces (AutoTrader / Dubizzle Motors class)

### H1. Controlled make/model/trim vocabularies, so structured queries are answerable

**Why it works.** "BMW 3-series, 2019+, automatic, under 100,000 km" is *the* query in this category.
It is only answerable if make and model are enumerated, not free text.

**Matjar: Partial, with a specific defect.** `categoryAttributes.automotive`
(`src/lib/attributes.ts:71-111`) defines brand, model, year, mileage, gearbox, fuel, condition.
Gearbox, fuel and condition are proper enumerations. But **`brand` and `model` are `type: "text"`**
(`attributes.ts:72-73`) — free text, so "BMW", "bmw" and "B.M.W" are three different brands. And
`year` and `mileage` carry no `filter: true` flag (`attributes.ts:74-75`), and the filter
implementation is exact string equality anyway (`store-products.tsx:829-833`) — so there is **no
range semantics at all**. A buyer cannot filter "under 100,000 km" even inside one dealer's page.

**Gap: precise and cheap to fix.** Enumerate brand; add range operators to the two numeric filters.

### H2. Inspection / history reporting as a paid trust layer

**Why it works.** Used-car buyers are buying down risk. A third-party inspection is what a platform
can sell that a private seller cannot provide.

**Matjar: Missing.** The nearest primitive is `store_verifications`, which certifies the *business*,
not the *vehicle*.

**Gap: real, defer.** Zero active automotive stores.

### H3. Valuation and finance calculators as top-of-funnel

**Why it works.** "What is my car worth" and "what would my monthly payment be" attract sellers and
buyers long before either is ready to transact.

**Matjar: Adjacent capability exists.** The merchant Hub already ships calculators —
`pricing-calculator.tsx`, `profit-calculator.tsx`, `invoice-generator.tsx`, `barcode-generator.tsx`
(`src/components/hub/`), plus `hub_tool_events` tracking. **But these are merchant-facing tools
behind a Pro paywall** (`OS_MODULE_META.tools`, `minPlan: "pro"`, `src/lib/sectors.ts:123`), not
public acquisition surfaces.

**Gap: the pattern is there, pointed the wrong way.** A public calculator is an SEO and acquisition
asset; a Pro-gated one is a retention feature. Both are valid — Matjar has only the second.

---

## Cross-cutting summary

Three findings recur across every category above, and they are the same finding three times.

**1. Matjar consistently builds the transaction engine and then does not expose it to discovery.**
The booking engine, the stay engine, the ticket engine, delivery zones, and the attribute vocabulary
are all real, all correct, and all reachable **only after the buyer has already picked a store**. The
marketplace layer — `/explore`, `/search`, `/map` — knows about exactly three things: store name,
region, and sector group. This is one architectural gap with seven symptoms, not seven gaps.

**2. Where Matjar leads the benchmark set, it leads on the merchant side.** A 35-module business OS
with POS, HR, attendance, accounting, automations, kitchen display and supplier ledgers is
substantially more than Fresha, Booksy or Eventbrite ship. The `verifications` queue, the staff
permission model, and the module registry itself are genuinely well built.

**3. Almost every "missing" item above is currently un-testable, because the demand does not exist.**
13 active stores, 65 products, 7 orders, 22 bookings, 169 page views in 30 days, and **12 of 17
sectors with zero active stores**. Ranking, dedupe, escrow, rate plans, courier tracking and
attribute facets are all correct diagnoses of problems Matjar does not yet have. See
`28_IMPLEMENTATION_ROADMAP.md`, which is written against these numbers rather than against this
benchmark.

**What I could not verify:** the `event_tickets` column list (E2); whether any competitor currently
implements any principle above in the form described (I did not inspect them).
