// Order arithmetic, extracted so it can be unit-tested and so the storefront
// preview and the server RPC can be proven to agree.
//
// The server (place_customer_order / place_guest_order) is authoritative — it
// re-reads every price from the catalog and never trusts the client. This module
// mirrors that same sequence for the cart preview; the tests pin the two
// together so a change to one that silently diverges from the other fails CI.

export type OrderLine = {
  /** Price actually charged per unit: flash → discount → list, plus add-ons. */
  unitPrice: number;
  quantity: number;
};

/** Round to cents the way `numeric(12,2)` does, avoiding float drift like
 *  2.99 * 3 = 8.969999999999999. */
export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Sum of every line. Each line is unit price × quantity — a line never borrows
 *  a price or a quantity from another line. */
export function subtotalOf(lines: OrderLine[]): number {
  return money(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
}

export type TotalsInput = {
  lines: OrderLine[];
  /** Coupon discount already resolved against the subtotal. */
  couponDiscount?: number;
  /** Loyalty points expressed in currency. Capped after the coupon. */
  pointsDiscount?: number;
  deliveryFee?: number;
};

export type Totals = {
  subtotal: number;
  /** What the order row stores in `discount`: coupon + points combined. */
  discount: number;
  deliveryFee: number;
  /** Goods total after discounts, never below zero. */
  net: number;
  total: number;
};

/**
 * The one place order totals are computed.
 *
 * Order of operations mirrors the RPC exactly:
 *   subtotal → minus coupon → minus points (capped at what's left) → plus
 *   delivery. Discounts can never drive the total negative, and the delivery
 *   fee is added after discounts so a coupon never eats the courier's fee.
 */
export function computeTotals({
  lines,
  couponDiscount = 0,
  pointsDiscount = 0,
  deliveryFee = 0,
}: TotalsInput): Totals {
  const subtotal = subtotalOf(lines);
  const coupon = money(Math.max(0, Math.min(couponDiscount, subtotal)));
  const afterCoupon = money(subtotal - coupon);
  const points = money(Math.max(0, Math.min(pointsDiscount, afterCoupon)));
  const net = money(Math.max(0, afterCoupon - points));
  const fee = money(Math.max(0, deliveryFee));
  return {
    subtotal,
    discount: money(coupon + points),
    deliveryFee: fee,
    net,
    total: money(net + fee),
  };
}

/**
 * Parse the stock trigger's `insufficient_stock:<name>` error.
 *
 * The trigger used to raise a bare `insufficient_stock`, so a customer with one
 * short item in an otherwise fine basket saw a blanket "out of stock" and read
 * it as the whole store being unavailable. Returning the name lets the UI point
 * at the exact line.
 */
export function parseStockError(message: string): string | null {
  if (!message.includes("insufficient_stock")) return null;
  const name = message.split("insufficient_stock:")[1]?.split(/["\n]/)[0]?.trim();
  return name && name.length > 0 ? name : null;
}
