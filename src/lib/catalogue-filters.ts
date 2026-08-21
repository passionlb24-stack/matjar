import { effectivePrice, type PricingFields } from "@/lib/pricing";
import { withinRange } from "@/lib/attributes";

// ===========================================================================
// What the shopper has narrowed the grid to — MJ-013, the arithmetic half
// ===========================================================================
//
// Split from the control for the reason lib/checkout.ts is split from
// checkout-form.tsx: what a filter DECIDES should be readable, and testable,
// without rendering anything. The control is
// components/store/catalogue-filters.tsx; which controls are worth offering at
// all is lib/attributes.ts.

/** A half-typed number is not a filter. Both ends are kept as raw text so that
 *  clearing the "to" box restores the full list instead of collapsing it to
 *  everything below zero, and so that "1." on the way to "1.5" narrows nothing
 *  in the meantime. */
export type RangeInput = { min: string; max: string };

export type CatalogueFilterState = {
  brand: string | null;
  /** Exact-match dropdowns, keyed by attribute key. */
  attrs: Record<string, string>;
  /** Attribute ranges, keyed by attribute key. */
  ranges: Record<string, RangeInput>;
  /** The price range. Not an attribute — a column — so not in `ranges`. */
  price: RangeInput;
};

/** Everything the filters read off a product. Structural, so a caller's own
 *  `Product` type satisfies it without either file importing the other's. */
export type FilterableProduct = PricingFields & {
  brand?: string | null;
  attributes?: Record<string, string> | null;
};

export const EMPTY_RANGE: RangeInput = { min: "", max: "" };

export function emptyFilters(brand: string | null = null): CatalogueFilterState {
  return { brand, attrs: {}, ranges: {}, price: EMPTY_RANGE };
}

/** A typed bound, or null for "no bound". Anything unparseable is no bound —
 *  a shopper mid-keystroke has not asked for an empty grid. */
export function bound(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Is anything actually narrowing the list? Drives the "clear" button and the
 *  "no matches" empty state — both of which must stay away from a shopper who
 *  has touched nothing, which is why an empty catalogue no longer reports
 *  itself as a filter that matched nothing. */
export function filtersActive(s: CatalogueFilterState): boolean {
  if (s.brand) return true;
  if (Object.values(s.attrs).some((v) => v)) return true;
  if (bound(s.price.min) != null || bound(s.price.max) != null) return true;
  return Object.values(s.ranges).some(
    (r) => bound(r.min) != null || bound(r.max) != null,
  );
}

/**
 * The predicate.
 *
 * Price compares against `effectivePrice` — the number actually printed on the
 * card after discount and flash — not the list price. A filter whose ends
 * disagree with the prices on screen is a filter that looks broken, and a
 * flash-priced item that vanishes from a range containing its own sticker price
 * is the specific way it would have looked broken.
 *
 * A row that does not carry a value never passes a set bound, exactly as a
 * blank never matches an exact-match dropdown. A car with no mileage recorded
 * is not "under 50,000 km".
 */
export function applyFilters<T extends FilterableProduct>(
  products: readonly T[],
  state: CatalogueFilterState,
): T[] {
  const attrs = Object.entries(state.attrs).filter(([, v]) => v);
  const ranges = Object.entries(state.ranges).filter(
    ([, r]) => bound(r.min) != null || bound(r.max) != null,
  );
  const pMin = bound(state.price.min);
  const pMax = bound(state.price.max);
  return products.filter((p) => {
    if (state.brand && (p.brand?.trim() ?? "") !== state.brand) return false;
    if (pMin != null || pMax != null) {
      const price = effectivePrice(p);
      if (pMin != null && price < pMin) return false;
      if (pMax != null && price > pMax) return false;
    }
    if (!attrs.every(([k, v]) => (p.attributes?.[k] ?? "") === v)) return false;
    return ranges.every(([k, r]) =>
      withinRange(p.attributes?.[k], bound(r.min), bound(r.max)),
    );
  });
}
