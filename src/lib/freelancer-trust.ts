// What a freelancer card can honestly claim, given what exists.
//
// A services marketplace normally sells on rating, jobs completed and repeat
// clients. All three are derived from transactions, and this section has none —
// so a Fiverr-shaped card renders "★ 0.0 · 0 projects · no badges". That reads
// as abandoned, where the plain card it replaces reads as new. The redesign is
// worth nothing if it makes the first impression worse.
//
// So the card has ONE evidence slot and this decides what goes in it. Two rules
// carry the whole design:
//
//   1. Never render a zero. No number is better than a zero.
//   2. Earned evidence outranks declared. As soon as a rating exists it takes
//      the slot from "delivers in 3 days", because a stranger's verdict beats
//      the seller's own promise.
//
// The card markup never changes. A freelancer upgrades through the states on
// their own, and nothing needs rebuilding when the first job lands.

export type TrustChip =
  | { kind: "rating"; rating: number; count: number }
  | { kind: "completed"; count: number }
  | { kind: "available" }
  | { kind: "delivery"; days: number }
  | { kind: "revisions"; count: number }
  | { kind: "samples"; count: number }
  | { kind: "region"; region: string };

export type GigTrustInput = {
  ratingAvg?: number | null;
  ratingCount?: number | null;
  completedCount?: number | null;
  availableUntil?: string | null;
  deliveryDays?: number | null;
  revisions?: number | null;
  gallery?: unknown[] | null;
  region?: string | null;
};

/** Availability is a dated promise; an expired one is not shown. */
export function isAvailable(
  availableUntil: string | null | undefined,
  todayIso: string,
): boolean {
  if (!availableUntil) return false;
  return availableUntil >= todayIso;
}

/**
 * Up to `max` chips, strongest evidence first.
 *
 * @param todayIso "YYYY-MM-DD" — passed in rather than read from the clock so
 *                 this stays pure and the server and client agree.
 */
export function trustChips(
  gig: GigTrustInput,
  todayIso: string,
  max = 3,
): TrustChip[] {
  const chips: TrustChip[] = [];

  // ── earned ───────────────────────────────────────────────────────────────
  // rating_avg is NULL until the first rating, never 0 — a 0 would render as a
  // one-star service, which is the opposite of "not rated yet".
  if (
    gig.ratingAvg != null &&
    gig.ratingCount != null &&
    gig.ratingCount > 0
  ) {
    chips.push({ kind: "rating", rating: gig.ratingAvg, count: gig.ratingCount });
  }
  if ((gig.completedCount ?? 0) > 0) {
    chips.push({ kind: "completed", count: gig.completedCount as number });
  }

  // ── declared ─────────────────────────────────────────────────────────────
  if (isAvailable(gig.availableUntil, todayIso)) {
    chips.push({ kind: "available" });
  }
  if ((gig.deliveryDays ?? 0) > 0) {
    chips.push({ kind: "delivery", days: gig.deliveryDays as number });
  }
  if ((gig.revisions ?? 0) > 0) {
    chips.push({ kind: "revisions", count: gig.revisions as number });
  }
  // Three or more samples is a portfolio; one is a thumbnail, and calling that
  // evidence cheapens the slot.
  const samples = gig.gallery?.length ?? 0;
  if (samples >= 3) {
    chips.push({ kind: "samples", count: samples });
  }
  // Last resort, and never empty in practice — in Lebanon proximity is a real
  // reason to pick someone, not filler.
  if (gig.region && gig.region.trim()) {
    chips.push({ kind: "region", region: gig.region.trim() });
  }

  return chips.slice(0, max);
}

/**
 * Which homepage sections are worth rendering.
 *
 * A section header above an empty row tells a visitor the marketplace is empty —
 * the one impression worth designing against while it is small. A section
 * appears only once it can fill itself.
 */
export type SectionKey = "available" | "nearby" | "new" | "topRated" | "mostHired";

export function visibleSections(
  facets: { total?: number; available?: number; rated?: number },
  minPerSection = 6,
): SectionKey[] {
  const total = facets.total ?? 0;
  // Below this, one full grid beats several thin rows.
  if (total < 20) return [];

  const out: SectionKey[] = [];
  if ((facets.available ?? 0) >= minPerSection) out.push("available");
  out.push("nearby", "new");
  if ((facets.rated ?? 0) >= minPerSection) out.push("topRated", "mostHired");
  return out;
}

/**
 * Which filters to offer. A filter that returns nothing is a dead end that says
 * more about the platform than about the query, so each one waits until it has
 * something behind it.
 */
export type FilterKey =
  | "category"
  | "region"
  | "verified"
  | "available"
  | "delivery"
  | "price";

export function visibleFilters(facets: {
  total?: number;
  verified?: number;
  available?: number;
  categories?: Record<string, number>;
  regions?: Record<string, number>;
}): FilterKey[] {
  const out: FilterKey[] = [];
  if (Object.keys(facets.categories ?? {}).length >= 2) out.push("category");
  if (Object.keys(facets.regions ?? {}).length >= 2) out.push("region");
  if ((facets.verified ?? 0) >= 1) out.push("verified");
  if ((facets.available ?? 0) >= 1) out.push("available");
  if ((facets.total ?? 0) >= 8) out.push("delivery", "price");
  return out;
}
