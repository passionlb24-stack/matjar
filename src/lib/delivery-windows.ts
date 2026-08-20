// Delivery windows, built from the hours the merchant already set.
//
// ── What already existed, and why this adds no table ───────────────────────
//
// MJ-008 asks for `orders.scheduled_for` and a `store_delivery_windows` table.
// Most of that is already here and has been for a while:
//
//   * `orders.scheduled_for` — migration 0194, a real column.
//   * Both checkout RPCs read it out of `p_custom_fields.scheduled_for` and
//     drop anything unparseable or in the past.
//   * `product-order.tsx` collects it, and `orders-filter.tsx` shows the
//     merchant "🕒 مجدوَل لـ" on the order. So a restaurant CAN take an order
//     for 8pm today, contrary to the row.
//   * `stores.hours` (0244) is a per-weekday open/close jsonb, and it is
//     POPULATED — ملحمة البركة has all seven days, Let's meat has all seven.
//   * `hours.ts` already turns a day's span into slots (`generateSlots`), which
//     is how the booking engine builds appointment times.
//
// `store_delivery_zones` also already exists (0172) with `eta_min_minutes` /
// `eta_max_minutes`, though not one store has created a single zone.
//
// So a second source of truth for "when can this shop deliver" would be a
// table that can disagree with the opening hours printed on the same page —
// the exact defect 0244 retired the free-text `opening_hours` field to avoid.
// A window is therefore DERIVED from the hours, not stored beside them.
//
// ── What was actually missing ──────────────────────────────────────────────
//
// Two things, and this file addresses the first:
//
//   1. The store CART could not schedule at all. Only the product page could,
//      so a customer filling a basket had no way to say "tomorrow morning" —
//      they had to buy one item at a time to get the option.
//   2. The picker that does exist is a bare `datetime-local` with no bound, so
//      nothing stops a customer scheduling a butcher for 3am on a Sunday. That
//      one lives in product-order.tsx and is NOT fixed here.

import { daySpan, generateSlots, type WeekHours } from "@/lib/hours";

/** One day the store is open, and the times still orderable on it. */
export type DeliveryWindow = {
  /** "YYYY-MM-DD" in the customer's own timezone — the value of a date input. */
  date: string;
  /** "HH:MM" starts, inside the store's hours for that weekday. */
  slots: string[];
};

/** Local "YYYY-MM-DD" (never toISOString, which would shift across midnight). */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export type WindowOptions = {
  /** How many days ahead to offer, including today. */
  days?: number;
  /** Slot granularity in minutes. */
  slotMinutes?: number;
  /** How long from now before the earliest slot — a shop cannot cut, bag and
   *  send in zero minutes, and offering a time that has effectively passed is
   *  the same broken promise as offering one outside opening hours. */
  leadMinutes?: number;
};

/**
 * The days and times this store can actually be asked for, from now.
 *
 * A day the merchant did not configure is not offered — closed means closed.
 * Today is dropped once its remaining slots are gone, so the picker never opens
 * on a day with nothing in it.
 *
 * Returns [] when the store has no hours configured at all, which is the signal
 * the caller uses to hide the control entirely. That matches how the rest of
 * the codebase decides whether a control is worth drawing (see the coverage
 * helpers in attributes.ts): a picker whose every option is unavailable reads
 * as broken, so it is better not to draw one.
 */
export function deliveryWindows(
  hours: WeekHours | null | undefined,
  now: Date,
  opts: WindowOptions = {},
): DeliveryWindow[] {
  if (!hours || Object.keys(hours).length === 0) return [];
  const days = Math.max(1, opts.days ?? 7);
  const slotMinutes = opts.slotMinutes ?? 60;
  const leadMinutes = opts.leadMinutes ?? 45;

  const out: DeliveryWindow[] = [];
  const earliestToday = now.getHours() * 60 + now.getMinutes() + leadMinutes;

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const span = daySpan(hours, d);
    if (!span) continue;
    let slots = generateSlots(span, slotMinutes);
    if (i === 0) {
      // Only today is filtered by the clock. An overnight span (18:00–02:00)
      // generates slots past midnight as "00:00"/"01:00", which compare as
      // early morning — they belong to tomorrow's small hours and are dropped
      // here rather than offered as if they were 15 hours ago.
      slots = slots.filter((s) => minutesOf(s) >= earliestToday);
    }
    if (slots.length === 0) continue;
    out.push({ date: localDate(d), slots });
  }
  return out;
}

/**
 * A chosen day + time as the ISO instant the RPC stores.
 *
 * Built from the LOCAL date and time so the customer's "8pm" is their 8pm, then
 * converted — which is what `new Date("YYYY-MM-DDTHH:MM")` (no zone suffix)
 * does. Returns null for anything incomplete, and the caller then sends no
 * `scheduled_for` at all, which is an ordinary order-now.
 */
export function scheduledForIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
