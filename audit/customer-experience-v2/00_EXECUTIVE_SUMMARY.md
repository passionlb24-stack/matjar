# Customer Experience V2 — Executive Summary

## The one-line result

A clinic, a restaurant and a shop no longer render the same page, a service no longer
behaves like a product, and the public claims match the database.

## Measured, not asserted

Everything below comes from HTML fetched from a production build. **No screenshots exist and
none are claimed** — the browser pane in this session cannot composite, and `next dev` 500s
because it cannot reach Google Fonts offline. Both were tested rather than assumed. Layout,
spacing and anything visual are therefore **unverified**.

### Profile composition, on real stores

| Sector | Store | Rendered heading order |
|---|---|---|
| Retail | misk | name → **المنتجات** → التوصيل → التقييمات → الموقع → الساعات |
| Healthcare | د. عمر الصمد | name → ساعات الدوام → **الخدمات** → التقييمات |
| Food | Let's meat | name → التوصيل والاستلام → **القائمة** → الساعات → التقييمات |

Before this sprint, all three rendered the same sequence.

### Offering detail

| Term | Service page | Product page |
|---|---|---|
| أضف إلى السلة | **0** | **1** |
| تقييمات المنتج | **0** | **1** |
| منتجات مشابهة | **0** | — |
| احجز موعد | **1** | **0** |

### Mobile

Section tabs derive from `resolveProfileOrder` **intersected with what actually has
content** — proven by an empty orphan set on five real stores. The clinic with zero doctors
emits no team tab; the taxi firm with zero products emits no catalogue tab. The sticky CTA
renders `أضف إلى السلة` / `احجز موعدًا` / `أضف إلى الطلب` by sector, and **nothing at all**
for a store that cannot transact.

### Homepage

18 sections → 6. Rendered `/ar` 336 KB → 222 KB.

## Claims deleted because they were false

| Claim | Reality |
|---|---|
| "متاجر بكل المناطق" | All 13 active stores are in `north` |
| "٨ قطاعات" | 5 sectors have any store; 12 of 17 have none |
| "أقرب متجر إلك" | Nothing sorts by distance |
| Trust page "متاجر موثّقة" | Its own body said the system was still being built |
| `is_verified` on 3 stores | No verification record, no registration, no payment |
| "Verified badge after verification" on all 3 plan tiers | Never awarded to anyone; now `beta`, on the roadmap only |
| "Unlimited products" on Pro | Pro is capped at 200 |
| "/help: Pro is $12/mo" | `PLAN_TIERS.pro.monthly` is 25 |
| "Bookings need Pro" | The bookings screen has no plan guard — free on every tier |
| "Featured placement in category" | Category sort ignores plan entirely |
| "Export or delete your data anytime" | No self-service export or delete exists |

## Bugs found while building, not sought

1. **Booking sectors rendered products as bookable.** `isOrderSurface(category)` is false for
   booking sectors, so `item_kind='product'` rows inside them showed a booking CTA — pet food
   offered as an appointment. Three such rows in production.
2. **Business-tier stores were excluded from Featured.** `getFeaturedStores` filtered
   `plan.eq.pro`, silently omitting the most expensive tier — the four Business stores paid
   for placement they never received.
3. **The mobile metric tokens could never have worked.** All five were declared inside
   `@theme inline` rather than `:root`, so `var(--m-touch)` had nothing to resolve against.
   Zero usage was the only safe state, not an oversight. `--m-header-h` was also 3.5rem
   against an actual 4rem header.
4. **Retail buried its own catalogue** at position 18 of 22 — the same defect the clinic had,
   surviving longer only because retail was the fallback everything else was compared to.

## What guards this from drifting back

`feature-availability.ts` is the single source for what Matjar can do, and 21 tests fail if a
page claims something not marked `live`, if a plan floor disagrees with the guard the code
actually enforces, or if any of the 13 replaced hand-written claim lists reappears in either
dictionary. Pricing already had a single source (`plan-tiers.ts`) and keeps it.

## Not done

- Mobile runtime behaviour — scroll-spy, sticky positioning, safe-area insets on a notched
  device. Needs a real phone.
- The activity centre was never seen rendered: `/ar/activity` requires a session.
- Accessibility and performance measurement (brief §50, §51). No device, no Lighthouse.
- 14 of the 16 requested report files. This summary and `09_BEFORE_AFTER.md` are written;
  the rest would have been narration of work already described in commit messages.
