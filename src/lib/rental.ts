// ===== Car-rental engine — the rules, in one testable place =====
//
// MJ-003. `rentals` was a module key with nothing behind it: no pickup/return
// dates, no deposit, no mileage policy, no insurance, no driver age. Automotive
// was therefore held in directory-only mode, because the only transaction the
// platform could have offered a car dealer was a cart and cash on delivery.
//
// Migration 0298 is the engine. This file is the half of it that runs in the
// browser, and it exists so the three rules a customer can get wrong — the
// range, the minimum days, the driver's age — are checked in ONE place that a
// unit test can reach, instead of being retyped into every form.
//
// A DELIBERATE DUPLICATION, AND THE ONLY ONE. `rentalDayPrices` computes the
// same per-day sum as `public.rental_base_total()` in 0298 (weekend = Friday
// and Saturday, matching Postgres' `extract(dow)` numbering, 5 and 6). The
// server is the authority — place_rental_booking() re-prices every booking and
// ignores whatever the client thought — but a storefront that cannot show a
// price until it has made a round trip is a storefront nobody uses. So the
// client computes the SAME number for display and the server computes it again
// for the record. If the two ever disagree, the server wins and the customer
// sees the server's figure on the confirmed booking.
//
// WHAT IS NOT HERE, ON PURPOSE: anything that decides availability. Whether a
// car is free on a range is answered by the exclusion constraint in the
// database and by search_rentals(); a client-side "is it free" helper would be
// a second opinion on the one question that must only ever have one answer.

/** The lifecycle of a rental — `public.rental_status` in 0298, in the order a
 *  merchant walks it. Kept in step with the enum by hand; the enum is the
 *  authority and an unknown value renders as itself (see status-labels.ts). */
export const RENTAL_STATUSES = [
  "requested",
  "confirmed",
  "declined",
  "picked_up",
  "returned",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/** The statuses that HOLD a car. Mirrors the `where` clause on the
 *  `rental_no_overlap` exclusion constraint: these three block the days, and
 *  every other status releases them. */
export const RENTAL_HOLDING_STATUSES: readonly RentalStatus[] = [
  "requested",
  "confirmed",
  "picked_up",
];

/** What a merchant states about one vehicle, as far as pricing is concerned. */
export type RentalPricing = {
  baseDailyPrice: number;
  /** Friday/Saturday rate. Null or absent = the base rate applies all week. */
  weekendPrice?: number | null;
  deliveryFee?: number | null;
  /** Stated by the merchant, collected by the merchant, in cash, at pickup.
   *  Matjar holds no money — see `rentalQuote`, which keeps it out of the
   *  total on purpose. */
  depositAmount?: number | null;
  minDays?: number | null;
  minDriverAge?: number | null;
};

/** Whole days between two ISO dates (`yyyy-mm-dd`), half-open `[pickup, return)`.
 *  Returns 0 for an empty or inverted range rather than a negative number, so a
 *  caller that forgets to validate cannot produce a negative price.
 *
 *  Parsed as UTC (`Date.UTC`) deliberately: a `new Date("2026-09-04")` in a
 *  negative-offset zone lands on the 3rd locally, and a rental that silently
 *  loses a day at the start of the range is the kind of bug that only shows up
 *  for a customer in another timezone. */
export function rentalDays(pickup: string, ret: string): number {
  const a = isoToUtc(pickup);
  const b = isoToUtc(ret);
  if (a == null || b == null) return 0;
  const days = Math.round((b - a) / 86_400_000);
  return days > 0 ? days : 0;
}

/** The price of each day in `[pickup, return)`, in order — Friday and Saturday
 *  at the weekend rate when the merchant set one, every other day at the base.
 *  Same rule, same day numbers, as `rental_base_total()` in migration 0298. */
export function rentalDayPrices(
  pricing: RentalPricing,
  pickup: string,
  ret: string,
): number[] {
  const start = isoToUtc(pickup);
  const days = rentalDays(pickup, ret);
  if (start == null || days === 0) return [];
  const base = num(pricing.baseDailyPrice);
  const weekend = pricing.weekendPrice == null ? base : num(pricing.weekendPrice);
  const out: number[] = [];
  for (let i = 0; i < days; i += 1) {
    const dow = new Date(start + i * 86_400_000).getUTCDay(); // 0=Sun … 6=Sat
    out.push(dow === 5 || dow === 6 ? weekend : base);
  }
  return out;
}

export type RentalQuote = {
  days: number;
  /** Sum of the per-day prices. */
  baseTotal: number;
  deliveryFee: number;
  /** What the customer owes the merchant: base + delivery. */
  grandTotal: number;
  /** What the merchant additionally asks for in cash at pickup, and returns
   *  when the car comes back. NOT part of `grandTotal`, and never charged by
   *  Matjar — the platform processes no cards and holds no funds. */
  depositAmount: number;
};

/** The money, split the way the storefront has to say it out loud.
 *
 *  The deposit is deliberately its own field rather than a line in the total.
 *  Matjar is cash-on-delivery and has no payment provider anywhere in the
 *  repository, so there is no mechanism by which it could hold a deposit; the
 *  merchant states an amount and takes it, in cash, in person. Folding it into
 *  `grandTotal` would make the page read as though the platform were
 *  collecting it, which would be false. Same choice the stay engine made with
 *  its security deposit (0191), and the same choice 0298 makes server-side. */
export function rentalQuote(
  pricing: RentalPricing,
  pickup: string,
  ret: string,
): RentalQuote {
  const prices = rentalDayPrices(pricing, pickup, ret);
  const baseTotal = prices.reduce((a, b) => a + b, 0);
  const deliveryFee = num(pricing.deliveryFee);
  return {
    days: prices.length,
    baseTotal,
    deliveryFee,
    grandTotal: baseTotal + deliveryFee,
    depositAmount: num(pricing.depositAmount),
  };
}

/** Why a requested rental cannot be made. `null` = it can.
 *
 *  These are the same four refusals `place_rental_booking()` raises, by the
 *  same names, so the form can say what is wrong before the round trip and the
 *  error path can reuse one set of words. The server still checks all four —
 *  this is a courtesy, not a gate. */
export type RentalRefusal =
  | "invalid_range"
  | "past_date"
  | "min_days"
  | "driver_too_young";

export function rentalRefusal(args: {
  pricing: RentalPricing;
  pickup: string;
  ret: string;
  driverAge: number | null;
  /** Today as `yyyy-mm-dd`, passed in so this stays a pure function and the
   *  test does not have to travel in time. */
  today: string;
}): RentalRefusal | null {
  const { pricing, pickup, ret, driverAge, today } = args;
  const days = rentalDays(pickup, ret);
  // A same-day rental gives an EMPTY date range, which overlaps nothing and
  // would slide straight past the double-booking guard. 0298 refuses it with a
  // check constraint; this refuses it before the customer gets that far.
  if (days === 0) return "invalid_range";
  if (pickup < today) return "past_date";
  if (days < Math.max(1, num(pricing.minDays) || 1)) return "min_days";
  const minAge = num(pricing.minDriverAge) || 0;
  if (minAge > 0 && (driverAge == null || driverAge < minAge))
    return "driver_too_young";
  return null;
}

/** Today as `yyyy-mm-dd` in the viewer's own zone — the value a `<input
 *  type="date" min>` needs. `toISOString()` would give UTC and can be
 *  yesterday for a Lebanese viewer after 21:00 in winter, which quietly makes
 *  the earliest selectable pickup a day the merchant will refuse. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `yyyy-mm-dd` → UTC epoch ms, or null if it is not that shape. */
function isoToUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

function num(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
