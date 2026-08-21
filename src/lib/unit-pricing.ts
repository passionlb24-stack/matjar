// Selling by the kilo, without touching how anything is totalled.
//
// ── The finding this exists for ────────────────────────────────────────────
//
// MJ-010 reads "no per-kg or per-unit pricing". Production is worse than that.
// ملحمة البركة's catalogue is, verbatim:
//
//   مفرومة $7.50 · كفتة $7.50 · شقف $7.80 · شرحات $7.80 · مقانق $7.39
//   سجق $7.60 · شاورما لحمة $7.80 · شاورما دجاج $7.50 · صدر دجاج $7.00
//   3 كيلو فخاد $6.00 → $5.00
//
// Those ARE per-kilo prices. $7.50 is what a kilo of minced beef costs in
// Tripoli; it is not what a portion of it costs. The butcher has been typing
// kilo prices into a field the platform reads as a price per piece, and the two
// have agreed only because he and his customers both silently assume "1 = one
// kilo". Nothing on the card says so. And "3 كيلو فخاد" is the workaround with
// its seams showing: the weight went into the NAME, because there was nowhere
// else to put it.
//
// So the gap is not that a butcher cannot price meat. It is that he already
// does, and the platform neither knows it nor tells the customer — and that a
// customer who wants half a kilo has no way to ask for one.
//
// ── The rule that shapes everything below ──────────────────────────────────
//
// `order_items.quantity` is `int not null` (0006) and `place_customer_order`
// computes `v_subtotal := v_unit * v_qty` from `products.price` (0194). Both are
// deployed. A fractional quantity is therefore not available, and re-typing that
// column is not an additive migration.
//
// So: **`products.price` stays the price of ONE orderable unit, and `quantity`
// stays an integer count of those units.** The three columns 0299 adds are
// descriptive — they say what one unit IS (a kilo, half a kilo, 250 grams) —
// and no server function reads them. Subtotal arithmetic is byte-identical to
// what it was; a product with `sold_by` null is indistinguishable from one that
// existed before the column did.
//
// The price per kilo is DERIVED from those, never stored. Storing it as well
// would be two answers to one question, which is the mistake `duration` made in
// attributes.ts and the one this file is careful not to repeat.
//
// ── The judgement call: is the cart total an estimate? ─────────────────────
//
// It is not, and labelling it one would be the dishonest choice here. The
// reasoning, because it is the part worth disagreeing with:
//
// A total is honestly called an estimate only when something later settles it.
// Settling means re-pricing a placed order, and this repo has no mechanism for
// that — no RPC mutates `orders.total`, there is no re-consent step, no audit
// trail for a changed total, and that column feeds the loyalty ledger, the
// invoice sequence and the margin report. A cart that says "estimate" and is
// never followed by a correction is a promise that never arrives: it teaches the
// customer the number cannot be trusted while giving them nothing better.
//
// So the ORDERED weight is the contract. The customer asks for 2 kg; the order
// says 2 kg and $15.00; the butcher cuts to 2 kg and the last few grams either
// way are his, exactly as they are when he rounds at the counter today.
//
// What the platform genuinely owes the customer is not a disclaimer about the
// arithmetic — it is the PER-KILO PRICE, printed where they can see it, so they
// can do the multiplication themselves and know they were not overcharged. That
// is the thing that is missing today, and it is what this delivers.
//
// The one thing that IS approximate is the physical cut, so that — and only
// that — is what the disclosure sentence says. It does not undermine the total,
// because the total is not the uncertain part.
//
// NOT BUILT, and named here so nobody assumes otherwise: the merchant cannot
// confirm a different final weight and re-price the order. That needs order
// mutation, which is a feature and not a column.

/** How a product is sold. `null` on every product that exists today. */
export type SoldBy = "weight" | "volume";

/** The measure one priced unit is expressed in. */
export type UnitMeasure = "kg" | "g" | "l" | "ml";

export const SOLD_BY_MEASURES: Record<SoldBy, UnitMeasure[]> = {
  weight: ["kg", "g"],
  volume: ["l", "ml"],
};

/** The measure a per-unit price is quoted against — grams roll up to the kilo,
 *  millilitres to the litre. Nobody says "$0.0075 per gram". */
const BASE: Record<UnitMeasure, UnitMeasure> = {
  kg: "kg",
  g: "kg",
  l: "l",
  ml: "l",
};

/** How many of `measure` make one of its base measure. */
const PER_BASE: Record<UnitMeasure, number> = { kg: 1, g: 1000, l: 1, ml: 1000 };

export const MEASURE_LABELS: Record<UnitMeasure, { ar: string; en: string }> = {
  kg: { ar: "كيلو", en: "kg" },
  g: { ar: "غرام", en: "g" },
  l: { ar: "ليتر", en: "L" },
  ml: { ar: "مل", en: "ml" },
};

/**
 * What one orderable unit of a product is.
 *
 * `amount` is expressed in `measure`: {measure:"kg", amount:1} is a kilo,
 * {measure:"kg", amount:0.5} a half kilo, {measure:"g", amount:250} 250 grams.
 * `products.price` buys exactly one of these.
 */
export type UnitPricing = {
  soldBy: SoldBy;
  measure: UnitMeasure;
  amount: number;
};

/** The row shape this reads. Every field is nullable and every field is null on
 *  every product that predates 0299. */
export type UnitPricedRow = {
  soldBy?: string | null;
  unitMeasure?: string | null;
  unitAmount?: number | null;
};

function isSoldBy(v: unknown): v is SoldBy {
  return v === "weight" || v === "volume";
}

function isMeasure(v: unknown): v is UnitMeasure {
  return v === "kg" || v === "g" || v === "l" || v === "ml";
}

/**
 * The unit pricing for a row, or `null` when it is sold by the piece.
 *
 * Deliberately strict: all three columns must be present, coherent and
 * positive, or the product falls back to piece pricing and renders exactly as
 * it always has. A half-configured product must never produce a per-kilo price
 * derived from a missing amount — that is a wrong number on a price tag, which
 * is worse than no unit at all.
 */
export function unitPricingOf(row: UnitPricedRow): UnitPricing | null {
  const { soldBy, unitMeasure, unitAmount } = row;
  if (!isSoldBy(soldBy) || !isMeasure(unitMeasure)) return null;
  if (!SOLD_BY_MEASURES[soldBy].includes(unitMeasure)) return null;
  if (unitAmount == null || !Number.isFinite(unitAmount) || unitAmount <= 0)
    return null;
  return { soldBy, measure: unitMeasure, amount: unitAmount };
}

/** One unit expressed in its base measure — 250 g → 0.25 (kg). */
export function amountInBase(u: UnitPricing): number {
  return u.amount / PER_BASE[u.measure];
}

/** The base measure a price is quoted per: "kg" for weight, "l" for volume. */
export function baseMeasure(u: UnitPricing): UnitMeasure {
  return BASE[u.measure];
}

/**
 * The headline price — "$7.50 / كيلو" — derived from the unit price and what a
 * unit is. Display only: it never enters a subtotal, and the server never sees
 * it. Rounded to cents so a 250 g unit at $1.87 quotes $7.48/kg rather than
 * $7.480000000000001.
 *
 * Uses the same round-half-up-on-cents rule as `money()` in order-math, so a
 * derived price and a charged price can never disagree in their last digit.
 */
export function pricePerBase(unitPrice: number, u: UnitPricing): number {
  const per = unitPrice / amountInBase(u);
  return Math.round((per + Number.EPSILON) * 100) / 100;
}

/** True when the price already IS the per-base price, so quoting both would
 *  print the same number twice ("$7.50 · $7.50 / كيلو"). */
export function isWholeBaseUnit(u: UnitPricing): boolean {
  return amountInBase(u) === 1;
}

/** How much a customer gets for `quantity` units, in the merchant's measure. */
export function measureForQuantity(u: UnitPricing, quantity: number): number {
  return u.amount * quantity;
}

/**
 * A quantity rendered as what it actually is — "٢ كيلو" rather than "٢".
 *
 * Trailing zeros are dropped (1.5 → "1.5", 2.0 → "2") and the number stays in
 * Western digits, matching `formatUsd`, so a weight and a price beside it are
 * the same kind of glyph. Callers must render this `dir="ltr"` with tabular
 * figures for the same bidi reason `Money` exists.
 */
export function formatMeasure(
  amount: number,
  measure: UnitMeasure,
  lang: "ar" | "en",
): string {
  const rounded = Math.round((amount + Number.EPSILON) * 1000) / 1000;
  const n = Number(rounded.toFixed(3)).toLocaleString("en-US");
  return `${n} ${MEASURE_LABELS[measure][lang]}`;
}

/** "١ كيلو" for the current cart quantity of a weight-sold line. */
export function formatQuantityMeasure(
  u: UnitPricing,
  quantity: number,
  lang: "ar" | "en",
): string {
  return formatMeasure(measureForQuantity(u, quantity), u.measure, lang);
}

// ---------------------------------------------------------------------------
// The merchant form's side of the same three columns
// ---------------------------------------------------------------------------
//
// These live here rather than beside the control in components/ because the
// product EDIT PAGE is a server component and has to build the initial value.
// A plain function exported from a "use client" module cannot be called on the
// server — it arrives as a client reference — so the conversion belongs in the
// pure module both sides can import.

/** What the merchant control holds while it is being edited. */
export type UnitPricingValue = {
  /** "" = sold by the piece, which is what every product is today. */
  soldBy: "" | SoldBy;
  measure: UnitMeasure;
  /** Kept as the raw input string so a half-typed "0." does not snap to 0. */
  amount: string;
};

export const PIECE_PRICED: UnitPricingValue = {
  soldBy: "",
  measure: "kg",
  amount: "1",
};

/**
 * Stored columns → the form's value. Anything that does not parse as a complete,
 * coherent unit falls back to piece pricing, so a row that somehow escaped the
 * check constraint opens as "By the piece" rather than as a half-filled control
 * the merchant cannot make sense of.
 */
export function unitPricingValue(
  soldBy: string | null,
  measure: string | null,
  amount: number | null,
): UnitPricingValue {
  const u = unitPricingOf({
    soldBy,
    unitMeasure: measure,
    unitAmount: amount,
  });
  if (!u) return PIECE_PRICED;
  return {
    soldBy: u.soldBy,
    measure: u.measure,
    amount: String(u.amount),
  };
}

/**
 * The form's value → the three columns, ready to spread into an insert or
 * update.
 *
 * Always returns all three keys, and all three null for a piece-priced item, so
 * a merchant switching a product back from weight to piece CLEARS the columns
 * rather than leaving a stale measure behind. `products_unit_pricing_check`
 * refuses a half-cleared row anyway; this makes sure the form never sends one.
 */
export function unitPricingColumns(v: UnitPricingValue): {
  sold_by: string | null;
  unit_measure: string | null;
  unit_amount: number | null;
} {
  const amount = Number(v.amount);
  if (!v.soldBy || !Number.isFinite(amount) || amount <= 0)
    return { sold_by: null, unit_measure: null, unit_amount: null };
  return { sold_by: v.soldBy, unit_measure: v.measure, unit_amount: amount };
}
