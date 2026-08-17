# 09 — Before / After

## Verification method, and its hard limit

**No screenshots exist and none are claimed.** The browser pane in this session cannot
composite frames, and the dev server cannot fetch Google Fonts offline. Both were tested,
not assumed.

Everything below is measured from **real rendered HTML**: `npx next build`, then
`next start`, then `curl`, then scripts and templates stripped with a parser (a naive grep
is worthless here — the entire dictionary ships inside the RSC flight payload, so every
string "appears" on every page).

Consequence: layout, spacing, rhythm and anything visual are **unverified**.

## Offering detail — the headline change

The complaint was that a dental cleaning behaved like a box of biscuits. Measured on the
visible text of two live pages:

| Term | Service page (مراجعة طبية, healthcare) | Product page (٣ كيلو فخاد, retail) |
|---|---|---|
| أضف إلى السلة | **0** | **1** |
| تقييمات المنتج | **0** | **1** |
| منتجات مشابهة | **0** | — |
| احجز موعد | **1** | **0** |
| تقييمات الخدمة | **1** | — |

The service page contains no cart language, no product-review heading and no "similar
products". The product page is unchanged. Both are real rows in active stores.

## Homepage

18 sections → 6. Rendered `/ar` fell from **336 KB to 222 KB**. All 13 removed headings
return 0 hits on the visible page. The `flex flex-col lg:block` + CSS `order` shuffle is
gone, so phones and desktop now read the same DOM sequence — which also retires the
screen-reader ordering tradeoff recorded in the previous mobile audit.

## Claims removed because they were false

| Claim | Why it went |
|---|---|
| "من كل لبنان — متاجر بكل المناطق" | All 13 active stores are in `north` |
| "٨ قطاعات مختلفة" (HomeStats) | 5 sectors have any store; 12 of 17 have none |
| "أقرب متجر إلك" / "قربك" | Nothing sorts by distance; 5 of 13 stores have coordinates |
| Trust page: "متاجر موثّقة" as a live feature | Its own body said the system was still being built; zero stores are verified |
| `is_verified` on 3 stores | No verification record, no commercial registration, no payment |

## A pre-existing bug found while building

`isOrderSurface(category)` is false for every booking-kind sector, so `item_kind='product'`
rows inside those stores rendered a **booking** CTA — pet food offered as an appointment.
Three such rows exist in production. The resolver now decides on kind first, so a product is
a product wherever it is sold.

## Profile composition — measured on real stores

Headings in rendered order, from live pages (scripts stripped with a parser):

| Sector | Store | Rendered order |
|---|---|---|
| **Retail** | misk | name → **المنتجات والخدمات** → التوصيل والاستلام → التقييمات → الموقع → ساعات الدوام |
| **Healthcare** | دكتور عمر الصمد | name → ساعات الدوام → **الخدمات** → التقييمات |
| **Food** | Let's meat | name → التوصيل والاستلام → **القائمة** → ساعات الدوام → التقييمات |

Three sectors, three different pages, one engine. Before this sprint all three rendered the
same sequence.

**The retail fix:** the goods sectors (retail, pharmacy, farm) had no composition of their
own, so they inherited a default in which the catalogue sat **eighteenth of twenty-two** —
below branches, delivery, the map, the hours, and nine sections that render nothing for a
shop. It is the same defect the clinic had; it survived longer only because retail was the
fallback every other sector was compared against. The catalogue is now position 3, directly
after the identity block.

## Discovery — filters that cannot lie

`/explore` filters now live in the URL and run server-side, so a filtered view is
shareable and indexable. Measured: `/ar/explore` → 13 cards · `?group=health` → 2 ·
`?sector=retail` → 7 · `?offers=1` → 1 · `?rated=1&open=1` → 2 · `/ar/category/automotive`
→ 0 cards **and no filter controls at all**.

Filters are suppressed when the data cannot back them — the region facet entirely (all 13
stores are `north`), verified/registered (zero stores), delivery and pickup (every store has
both, so they narrow nothing), clinic specialties and insurance (columns NULL everywhere).
The suppression is computed from live counts, not hardcoded: a filter returns the moment a
merchant fills the field in.

## Still not verified

No screenshots, no layout, no RTL mirroring, no measured touch targets, and the mobile
bottom sheet has never been opened. Everything above is rendered-HTML evidence.
