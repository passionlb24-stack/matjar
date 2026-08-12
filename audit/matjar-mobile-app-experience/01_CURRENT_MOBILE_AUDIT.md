# 01 — Current mobile audit

Measured on the running app at 375×812 (Arabic RTL), dev server on :3220.

## Stack

| | |
|---|---|
| Framework | Next.js 16.3, App Router, RSC + Suspense |
| Styling | Tailwind v4, `@theme inline` tokens in `src/app/globals.css` |
| Fonts | Tajawal (body), Alexandria (display) |
| Direction | Arabic RTL is the default locale; English LTR supported |
| Pages | 139 total — 64 customer `(site)`, 71 dashboard `(dashboard)`, 4 other |
| Components | 208, of which 14 are `ui/` primitives |
| Breakpoint strategy | Tailwind defaults; `lg` (1024px) is the phone/desktop switch |

## Measured findings

### Layout — good
- `document.scrollWidth === clientWidth` on `/ar` and `/ar/explore` at 375px. **No horizontal overflow.**
- Bottom nav is `fixed inset-x-0 bottom-0 z-50 … pb-[env(safe-area-inset-bottom)] lg:hidden`. Safe area handled.
- Header is `sticky top-0 z-50`. Two sticky layers only — no stacking conflicts found.

### Tap targets — 4 under 44px, all in the global header
| Element | Measured |
|---|---|
| Logo link | 89×36 |
| "افتح متجرك" | 97×36 |
| Menu button | 36×36 |
| Search entry link | 335×40 |

Because they are in the header, this affects **every route**.

### Typography — 4 nodes under 12px
9px and 10px inside the app-download badges on the home page ("حمّل على", "قريباً", "متوفّر على"). Below the 12px floor where Arabic diacritics stop being legible on a phone.

### Discovery controls
`/explore` exposes, as wrapped chips in a `flex flex-wrap gap-2` container:
- 9 category chips, 6 region chips, sort options
- header search input measured **210px wide** at 375px viewport

On a phone this becomes stacked rows of chips above the results. The benchmark pattern is one horizontally scrolling rail + a bottom sheet holding the rest.

### Customer activity is scattered
| Concern | Route | Reachable from tab bar? |
|---|---|---|
| Orders | `/orders` | no |
| Bookings | `/bookings` | no |
| Craft/service requests | `/crafts/requests` | no |
| Messages | `/messages` | no |
| Favourites | `/favorites` | no |
| Wishlist | `/wishlist` | no |

All six sit behind Account. None has a tab.

### Merchant on a phone
`merchant-sidebar.tsx` renders a 48px sticky strip plus `fixed inset-0 z-50 overflow-hidden lg:hidden` — a full-screen drawer. There is **no merchant bottom navigation**. Operational screens (orders, bookings, inventory) are reached by opening the drawer each time.

### Cart
Cart state lives inside `store-products.tsx` (1,540 lines, the largest client component) as `useState<Record<string, number>>` persisted to `localStorage` under `matjar-cart-${storeId}`. Consequences:
- cart is **per store**, by design (each order belongs to one merchant) — correct for the model
- but there is **no global "your carts" view**; a customer with items at two shops has no way to see that
- the entire cart + checkout UI ships inside the store page bundle

### Loading / empty / error states
- 18 `loading.tsx` files including a `(site)` group fallback — no route streams to a blank screen
- `EmptyState` used in 41 files
- `notifyError` / `notifySuccess` toasts are the global feedback channel
