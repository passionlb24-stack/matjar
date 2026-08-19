// A shared placeholder for the image-first cards (stores, products, portfolio).
//
// ===== Read this before believing it does more than it does =====
//
// `placeholder="blur"` needs either a static import — Next generates a real
// per-image blur hash at build time — or an explicit `blurDataURL`. Every image
// on these cards is a REMOTE Supabase Storage URL chosen by the merchant at
// runtime, so the static-import path does not exist here. Producing a genuine
// per-image hash would mean a server-side step this codebase has no place for
// yet: something that downloads each upload, downsamples it, and writes the
// base64 next to the row (a column on `stores` / `products`, filled by the
// upload handler or a Storage webhook). That does not exist, so this is not it.
//
// What this IS: one 1×1 translucent neutral grey PNG, the same 96 bytes for
// every image on the site.
//
// What it buys:
//   • The image box is a soft, theme-neutral tone from first paint instead of
//     an empty hole, so a card on a slow connection fades in rather than
//     snapping from nothing to a photo. The PNG is ~18% alpha, so it tints
//     whatever surface is behind it and reads correctly in light and dark.
//   • ~96 bytes inline per image, no extra request, no build step.
//
// What it does NOT buy — do not claim these:
//   • It is not layout stability. Nothing here reserves space; the card's own
//     fixed dimensions or aspect-ratio box do that, and they already did.
//   • It is not a preview of the image. It carries no colour, no shape and no
//     information from the actual photo, so it cannot "look like" it loading in.
//     Every store, every product and every portfolio shot gets the same grey.
//   • It is not a measured performance win. No LCP or CLS number was taken
//     before or after. It changes what the loading state looks like; it does
//     not change when the bytes arrive.
//
// If a real per-image hash is wanted later, this constant is the single place
// the fallback lives — the cards read it by name, so they keep working while
// each row that HAS a stored hash starts passing its own instead.
export const NEUTRAL_BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNoaGjQAwAEswGvwWc5XAAAAABJRU5ErkJggg==";
