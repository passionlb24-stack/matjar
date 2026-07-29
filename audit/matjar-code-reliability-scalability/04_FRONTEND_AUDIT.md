# 04 — Frontend Audit

_Checkpoint 0. Scope: home, store, product, cart/checkout, booking, merchant dashboard + orders. Evidence `file:line`._

## Verdict
Frontend discipline is **strong**: **no `select("*")` anywhere**, **no `as any` anywhere**, every realtime channel/timer checked cleans up, cart checkout has real double-submit + idempotency protection, and every mutation recomputes prices server-side. Problems concentrate in **two server pages that don't parallelize/paginate** plus a few small inconsistencies.

## Findings

| ID | Title | Severity | Evidence |
|---|---|---|---|
| FE-01 | Store page serial query waterfall (~12–18 sequential awaits) | High | `store/[id]/page.tsx:156-479` |
| FE-02 | Merchant orders page loads ALL orders (+order_items join) and ALL payments, unpaginated | High | `orders/page.tsx:72-78,101-105` |
| FE-03 | Store reviews fetched unbounded; average reduced in JS | Medium | `store/[id]/page.tsx:161-166,306-308` |
| FE-04 | Product "buy now" omits idempotency key → duplicate-order risk on retry | Medium | `product-order.tsx:163-210` (rpc call ~179) |
| FE-05 | Dashboard auth-guard waterfall (auth→can_manage_store→store→staff) repeated on ~40 pages | Medium | `orders/page.tsx:60-70`, `reports/page.tsx:159-194`, etc. |
| FE-06 | product-order stock error never calls `router.refresh()` → stale in-stock UI | Low | `product-order.tsx:200-207` |
| FE-07 | Cart has no multi-tab `storage` sync (last-writer-wins) — UX only, NOT a price bug | Low | `store-products.tsx:180-200` |
| FE-08 | Money/ID rows shaped with `as unknown as` — tsc won't catch column drift on money fields | Low/Info | `store-products.tsx:340`, `orders/page.tsx:79`, `store/[id]/page.tsx:423` |

### FE-04 (Medium) — the actionable correctness bug
`store-products.tsx` generates a per-attempt idempotency UUID (`:1312`) and passes `p_idempotency_key` (`:521`), so a double-tap collapses to one order. `product-order.tsx` (the product-page "buy now") relies only on `disabled={placing}` and omits the key — a stalled request the user retries can create **duplicate orders**, even though the RPC supports dedup. **Fix:** mirror the store-products pattern.

## Verified correct (no action)
- **Cart checkout**: submit disabled while placing (`:1282`), per-attempt idempotency (`:1312`), server-side price recompute enforced by RPC, localStorage stores **quantities only** → **no stale-price/money risk**.
- **Client/server boundary**: the `LucideIcon` from the store page is passed only into **server** components (`StoreHero/Header/ProductsSection`) — never into a `"use client"` child → no RSC serialization crash. No server page passes an inline handler to a client child.
- **Effect cleanup**: `header-bells`, `realtime-notifications`, `auto-refresh`, `kitchen-board`, `message-thread`, `flash-countdown`, dropdowns/menus all `clearInterval`/`removeChannel`/`removeEventListener` and restore `body.style.overflow`. No leaks found.
- **Browser APIs**: all `window`/`document`/`localStorage` uses are effect/handler-scoped or `typeof`-guarded. `createPortal` gated behind open state. No unguarded browser access during render.
- **Booking**: double-submit guard + atomic `place_booking` with specific error codes + slot re-check.
- **Silent catches**: only the two localStorage guards + fire-and-forget checkout-intent — intentional, isolated from checkout.

## God components (maintainability)
| Lines | File | Note |
|---:|---|---|
| 1328 | `store-products.tsx` | catalog + cart + coupons + loyalty + zones + guest & auth checkout in one client component |
| 884 | `booking-panel.tsx` | services + providers + slots + waitlist + coupons |
| 825 | `automation-manager.tsx` | |
| 777 | `crm-manager.tsx` | |

`store-products.tsx` and `booking-panel.tsx` are the two worth decomposing (orthogonal state in one component). Not a runtime risk; a change-safety/testability risk.

## Responsive / RTL
Not runtime-tested this checkpoint (would need the browser preview across the 320–1920 breakpoint matrix). Static review shows Tailwind responsive classes + `rtl:` variants used throughout and an RTL-default layout. **Marked: needs runtime verification** across the breakpoint matrix in `13/14`.
