/**
 * The canonical order journey, and the compact form of it used on cards.
 *
 * These flows were already written down once, inline in `order-timeline.tsx`
 * (migration 0173). Adding a second copy here for the orders list is how the
 * two drift: the same repo already learned this with a basket total, and the
 * comment there is blunt about it — two places that add up a basket are two
 * places that can disagree about it. So the flow lives here and the timeline
 * imports it.
 *
 * Writing the copy is also what caught a real bug. The first version of this
 * file left `ready` out of the delivery flow, on the assumption that a delivery
 * goes straight from `preparing` to `out_for_delivery`. It does not: an order
 * is made ready, and *then* a driver takes it. A delivery order sitting at
 * `ready` would have rendered no track at all — the progress bar vanishing at
 * exactly the moment the customer's food was ready. The timeline had it right
 * since 0173.
 *
 * `pending` is a step of the journey but not of the compact bar. It is the
 * state before the merchant has looked, and on a card it gets its own line
 * ("بانتظار تأكيد المتجر") — a filled dot there would imply the shop has agreed
 * to something it has not yet seen.
 */

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "rejected";

export type Fulfillment = "delivery" | "pickup";

/**
 * The full journey, including `pending`. `fulfillment` is an enum of exactly
 * `delivery | pickup` and the two do not share an end: only a delivery is ever
 * `out_for_delivery`, so a pickup customer is never shown a van that is not
 * coming.
 */
export const ORDER_FLOW: Record<Fulfillment, readonly OrderStatus[]> = {
  delivery: [
    "pending",
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
    "completed",
  ],
  pickup: ["pending", "accepted", "preparing", "ready", "completed"],
};

/** The journey minus `pending` — what the compact bar draws. */
const COMPACT: Record<Fulfillment, readonly OrderStatus[]> = {
  delivery: ORDER_FLOW.delivery.filter((s) => s !== "pending"),
  pickup: ORDER_FLOW.pickup.filter((s) => s !== "pending"),
};

export type OrderProgress = {
  /** Steps complete, counting the one in progress. 0 before acceptance. */
  reached: number;
  total: number;
  /** The step the order is standing on, for the one-line readout. */
  current: OrderStatus | null;
};

/**
 * `cancelled` and `rejected` end the story, and a track with a dead end drawn
 * on it reads as "still on its way" — so they get no track and the caller falls
 * back to the status pill, which says the true thing.
 */
export function orderProgress(
  status: OrderStatus,
  fulfillment: Fulfillment,
): OrderProgress | null {
  if (status === "cancelled" || status === "rejected") return null;
  const track = COMPACT[fulfillment];
  if (status === "pending") {
    return { reached: 0, total: track.length, current: null };
  }
  const idx = track.indexOf(status);
  // A status that cannot belong to this fulfilment method — a pickup marked
  // out_for_delivery — is a data question, not a rendering one. Show the honest
  // pill rather than a track that contradicts it.
  if (idx < 0) return null;
  return { reached: idx + 1, total: track.length, current: status };
}

/** Whether to show the "waiting for the shop to confirm" line instead. */
export function isAwaitingMerchant(status: OrderStatus): boolean {
  return status === "pending";
}

/**
 * How much of the bar to fill. The step in progress counts as half: "قيد
 * التحضير" means that step is happening, not that it is finished, and a bar
 * that fills completely on the step you are standing on tells the customer the
 * order is done when it is not.
 */
export function progressPercent(p: OrderProgress): number {
  if (p.reached === 0) return 0;
  const complete = p.reached - 1;
  const atLast = p.reached === p.total;
  return Math.round(((complete + (atLast ? 1 : 0.5)) / p.total) * 100);
}
