// Single source of truth for "what does this product cost right now".
// Flash price wins while its window is open, then a standing discount, then
// the base price. Every surface that shows or charges a price should use this
// so the money path stays consistent.

export type PricingFields = {
  price: number;
  discountPrice?: number | null;
  flashPrice?: number | null;
  flashStart?: string | null;
  flashEnd?: string | null;
};

export function isFlashActive(p: PricingFields, now: number = Date.now()): boolean {
  if (p.flashPrice == null || !p.flashStart || !p.flashEnd) return false;
  const start = new Date(p.flashStart).getTime();
  const end = new Date(p.flashEnd).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end;
}

/** The price the customer actually pays right now. */
export function effectivePrice(p: PricingFields, now: number = Date.now()): number {
  if (isFlashActive(p, now)) return Number(p.flashPrice);
  if (p.discountPrice != null) return Number(p.discountPrice);
  return Number(p.price);
}

/** The price to show struck-through next to the effective price (or null). */
export function compareAtPrice(p: PricingFields, now: number = Date.now()): number | null {
  if (isFlashActive(p, now)) return Number(p.price);
  if (p.discountPrice != null) return Number(p.price);
  return null;
}

/** Epoch ms when the active flash ends, or null if no flash is running. */
export function flashEndsAt(p: PricingFields, now: number = Date.now()): number | null {
  return isFlashActive(p, now) ? new Date(p.flashEnd as string).getTime() : null;
}
