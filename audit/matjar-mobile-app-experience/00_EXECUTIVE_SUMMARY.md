# Matjar mobile app experience — Batch 0 executive summary

**Branch:** `feat/mobile-app-experience` (cut from `main` at `5b277e6`, clean tree)
**Baseline gates:** typecheck clean · lint 0 errors / 9 known warnings · 154 tests pass · build succeeds
**Scope of this batch:** audit + architecture + plan only. **No pages were modified.**

---

## The headline

Matjar is **not** a desktop site squeezed onto a phone. It already has a bottom tab bar, safe-area handling, `viewportFit: cover`, a token system that adapts to dark mode, RTL-first Arabic, 18 loading skeletons and zero horizontal overflow at 375px on the routes probed. That is a better starting point than the brief assumes.

The gap is not responsiveness. It is **three architectural decisions that were made for desktop and never revisited for the phone**:

1. **The customer tab bar navigates to places, not to the user's own activity.**
   Tabs are Home / Explore / Market / Account. A customer who placed an order, booked an appointment, sent a service request and saved a store has **five separate destinations** (`/orders`, `/bookings`, `/crafts/requests`, `/favorites`, `/wishlist`) and **none of them is one thumb away**. Every marketplace app in the benchmark set gives activity a permanent tab. Matjar gives it a link inside Account.

2. **The merchant on a phone gets a hamburger drawer.**
   `MerchantSidebar` renders a 48px sticky bar and a full-screen overlay (`fixed inset-0 z-50 lg:hidden`). That is precisely the pattern the brief names as forbidden — desktop navigation folded into a menu. A butcher checking orders between customers should not open a drawer to find them.

3. **Discovery filters use a desktop control on a phone.**
   `/explore` renders 9 category chips + 6 region chips + sort as `flex flex-wrap` — they stack into rows and push results down the page. The mobile pattern is a horizontal chip rail plus a bottom sheet, not a wrapped grid.

Everything else in the brief is either already right, or a smaller finish on top of these three.

---

## What is already app-grade (do not rebuild)

| Capability | State |
|---|---|
| Bottom tab bar with safe-area padding | present, `pb-[env(safe-area-inset-bottom)]` |
| `viewportFit: cover`, per-scheme theme colour | present |
| Design tokens, dark mode, AA-checked semantic pairs | present |
| Type scale tuned for Arabic leading, `.text-money` LTR isolation | present |
| Loading skeletons | 18 `loading.tsx`, including a `(site)` group fallback |
| Horizontal overflow at 375px | **none found** on `/ar`, `/ar/explore` |
| Sticky mobile buy bar on product pages | present |
| Reduced-motion guard | global |

## What is missing or wrong

| # | Finding | Evidence |
|---|---|---|
| 1 | No customer activity centre | 5 separate routes, no tab |
| 2 | Merchant mobile nav is a drawer | `merchant-sidebar.tsx:295` |
| 3 | Filters wrap instead of scrolling | `flex flex-wrap gap-2` on `/explore` |
| 4 | Search is a 210px header field, not a screen | measured at 375px |
| 5 | Service worker has **no fetch handler** | `public/sw.js` is push-only, 35 lines |
| 6 | SW only registers if the user opts into push | `push-opt-in.tsx:43` |
| 7 | Icon set is one 512px PNG | no 192, no `apple-icon` |
| 8 | 4 tap targets under 44px in the global header | 89×36, 97×36, 36×36 |
| 9 | 9–10px text in the app-download badges | home page |
| 10 | Cart is per-store in `localStorage`, no global cart view | `store-products.tsx:191` |

Full list with severity and fixes: `MOBILE_ISSUES.csv`.

---

## Recommended plan

Batches 1–6 as specified in the brief, with one change of order I want to flag: **Batch 1 (app shell) should ship the customer activity centre with the tab bar**, not wait for Batch 4. A fifth tab pointing at a route that does not exist yet is worse than the current four.

| Batch | Contents | Risk |
|---|---|---|
| 1 | Customer tab bar → 5 tabs incl. activity; activity centre route; merchant bottom shell; mobile spacing tokens | medium — touches every page's chrome |
| 2 | Home, search screen, category rail, filter sheet, cards | medium |
| 3 | Product, cart, checkout, booking, confirmation | **high** — money paths, most careful batch |
| 4 | Activity detail, favourites, profile | low |
| 5 | Merchant home, operations inbox, mobile tables | medium |
| 6 | PWA (fetch handler, icons, always-register SW), performance, a11y | low–medium |

## Honest constraint

This session's browser pane is **not compositing** — `computer{screenshot}` times out and `IntersectionObserver` never fires (verified with a bare probe element, not assumed). Pixel screenshots required by §45/§51 cannot be produced here.

Substituted with **quantitative DOM probes** run against the real rendered pages: viewport width, `scrollWidth` overflow, every tap target under 44px with its measured size, every text node under 12px, and elements covered by the fixed bottom nav. These are reproducible and were used to generate the CSV. Where a finding needs a human eye (visual polish, animation feel), it is marked as such rather than claimed as verified.
