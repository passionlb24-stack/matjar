// MP-039 / MP-040 / MP-041 — explicit ceilings for list fetches.
//
// PostgREST answers an unbounded `.select()` with at most `db-max-rows` (1000
// by default) and reports success. There is no error, no flag, no short-read
// signal: the array simply stops. A store with 1001 variants renders 1000 of
// them and looks fine. That failure is invisible in exactly the situation
// where it matters most — a merchant who finally grew past the ceiling.
//
// So every list fetch names its own ceiling here, and every fetch checks
// whether it came back full. A full page is not proof of truncation (a store
// with exactly 200 sections is legal), but it is the only observable the
// database gives us, and at these ceilings a false alarm is far cheaper than a
// silent one.
//
// Bounds are set comfortably above any plausible real-world value rather than
// close to today's data (36 stores / 63 products / 15 active stores), so the
// warning stays quiet until something genuinely unusual happens.

/** Row ceilings, one per surface. Raising one is a deliberate, reviewable act. */
export const FETCH_BOUNDS = {
  /** Variants of a single product (size × colour grids get wide). */
  productVariants: 200,
  /** Add-ons / options of a single product. */
  productOptions: 200,
  /** Modifier groups of a single product. */
  productModifierGroups: 50,
  /** Components listed inside one bundle. */
  bundleItems: 200,
  /** Components across every bundle in one store's catalog. */
  storeBundleItems: 2000,
  /** A single store's active catalog. Beyond this the storefront needs real
   *  pagination, not a bigger number — it renders the whole array. */
  storeProducts: 2000,
  /** Variant rows across a whole store's catalog (many per product). */
  storeVariants: 5000,
  /** Named sections/collections in one store. */
  storeSections: 200,
  /** Merchant-defined checkout fields in one store. */
  storeCheckoutFields: 50,
  /** Branch locations for the stores on one rendered page. */
  storeLocations: 500,
  /** Every active product platform-wide — discovery's catalog-facts rollup.
   *  This one scales with total catalog size, not store count, so it is the
   *  most likely of all of these to hit its ceiling first. */
  allProducts: 20000,
  /** Every store_sections row platform-wide (same rollup). */
  allStoreSections: 5000,
  /** Practitioner rosters platform-wide (doctors + service_providers). */
  allProviders: 5000,
  /** Stores the current viewer follows. */
  follows: 2000,
  /** One seller's own market listings. */
  myListings: 500,
  /** Reference taxonomies. lb_areas in particular is close enough to 1000 that
   *  the default PostgREST cap was a live risk, not a theoretical one. */
  referenceRows: 5000,
} as const;

/**
 * Sound the alarm when a bounded fetch comes back full.
 *
 * Server-side `console.warn` rather than a thrown error or a returned flag:
 * every caller is a read path that renders a page, and a store that has grown
 * past its ceiling should still serve — loudly degraded, not broken. The
 * message names the surface and the bound so the fix is a one-line edit here.
 *
 * @param rows  the array PostgREST returned (nullish is treated as empty)
 * @param limit the ceiling that was passed to `.limit()`
 * @param what  human-readable surface name, e.g. `"product_variants (product 123)"`
 */
export function warnIfTruncated(
  rows: readonly unknown[] | null | undefined,
  limit: number,
  what: string,
): void {
  const n = rows?.length ?? 0;
  if (n < limit) return;
  console.warn(
    `[matjar:fetch-bound] ${what} returned ${n} rows and hit its ${limit}-row ceiling. ` +
      `Rows beyond the ceiling are NOT rendered. Raise the bound in ` +
      `src/lib/data/bounds.ts or paginate this surface.`,
  );
}
