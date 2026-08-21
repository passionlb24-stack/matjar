"use client";

import dynamic from "next/dynamic";

// ===== The checkout subtree, fetched when there is something to check out =====
//
// M-017 asked for "checkout split out and loaded when entered". The SPLIT
// already happened — the form is `checkout/checkout-form.tsx` and the arithmetic
// is `lib/checkout.ts` — but both were still STATIC imports of
// `store-products.tsx`, so every storefront visitor downloaded the coupon field,
// the loyalty redemption panel, the delivery-zone picker, the address book, the
// change-for input and the RPC call before they had looked at a single price.
//
// WHY THIS IS A CLIENT MODULE, and not `next/dynamic` inside the server
// component that renders the storefront: under Next 16 + Turbopack a server
// component cannot open an async chunk boundary in the CLIENT graph, because it
// is not in that graph — the client-reference manifest keeps listing the target
// as a synchronous reference. The thunk has to live on the client side of the
// boundary. Same reason, same finding, as `lazy-engines.tsx` next door.
//
// WHY THIS IS SAFE ON THE MONEY PATH, which is the part that matters:
//
//   • Neither component can render on the server anyway. Both sit inside
//     `items.length > 0`, and `items` is derived from a cart that is read out of
//     localStorage in an effect (never during render, to avoid a hydration
//     mismatch). The server therefore renders an empty cart, no checkout, and no
//     confirmation — exactly what it rendered before this file existed. No
//     markup is lost.
//
//   • The fetch starts when the FIRST item is added, not when "Checkout" is
//     tapped. `store-products.tsx` keeps mounting the form hidden rather than
//     unmounting it, so the chunk request goes out the moment the cart stops
//     being empty — several taps, and usually several seconds, before anyone can
//     reach it. A returning customer whose cart was restored from localStorage
//     starts the fetch on mount.
//
//   • `loading` is a sized placeholder rather than `null`, for the one customer
//     the paragraph above does not cover: add one item, tap Checkout instantly,
//     on a connection slow enough that the chunk has not landed. They get a
//     panel that is visibly loading instead of a box that is visibly empty.
//
// `ssr` is left at its default on both. Nothing changes about WHERE they render,
// only about WHEN the browser fetches them.

const Pending = () => (
  <div
    className="h-40 animate-pulse rounded-xl bg-surface-muted"
    aria-busy="true"
  />
);

export const CheckoutForm = dynamic(
  () =>
    import("@/components/checkout/checkout-form").then((m) => m.CheckoutForm),
  { loading: Pending },
);

export const OrderPlaced = dynamic(
  () => import("@/components/checkout/order-placed").then((m) => m.OrderPlaced),
  { loading: Pending },
);
