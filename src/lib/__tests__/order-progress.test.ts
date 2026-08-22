import { describe, it, expect } from "vitest";
import {
  ORDER_FLOW,
  orderProgress,
  progressPercent,
  isAwaitingMerchant,
  type OrderStatus,
} from "@/lib/order-progress";

// These guard against a track that tells the customer something untrue: a van
// on a pickup order, a full bar on an order still being cooked, a live-looking
// track on an order the shop already refused — or, the bug the first draft of
// this module actually had, no track at all on a delivery that is `ready`.

describe("ORDER_FLOW", () => {
  it("keeps `ready` on the delivery flow", () => {
    // The bug this file was written with: a delivery was assumed to go
    // preparing -> out_for_delivery. It does not. It is made ready, and THEN a
    // driver takes it, so a delivery sitting at `ready` must still draw a track.
    expect(ORDER_FLOW.delivery).toContain("ready");
    expect(orderProgress("ready", "delivery")).not.toBeNull();
  });

  it("never puts out_for_delivery on a pickup", () => {
    expect(ORDER_FLOW.pickup).not.toContain("out_for_delivery");
    expect(orderProgress("out_for_delivery", "pickup")).toBeNull();
  });

  it("starts both journeys at pending and ends both at completed", () => {
    for (const f of ["delivery", "pickup"] as const) {
      expect(ORDER_FLOW[f][0]).toBe("pending");
      expect(ORDER_FLOW[f][ORDER_FLOW[f].length - 1]).toBe("completed");
    }
  });
});

describe("orderProgress", () => {
  it("counts the compact track without pending", () => {
    const d = orderProgress("accepted", "delivery")!;
    const p = orderProgress("accepted", "pickup")!;
    expect(d.total).toBe(ORDER_FLOW.delivery.length - 1);
    expect(p.total).toBe(ORDER_FLOW.pickup.length - 1);
    expect(d.reached).toBe(1);
  });

  it("fills nothing while the shop has not accepted", () => {
    const p = orderProgress("pending", "delivery")!;
    expect(p.reached).toBe(0);
    expect(p.current).toBeNull();
    expect(progressPercent(p)).toBe(0);
    expect(isAwaitingMerchant("pending")).toBe(true);
  });

  it("draws no track for an order that ended badly", () => {
    // A dead end drawn as a track reads as "still on its way".
    expect(orderProgress("cancelled", "delivery")).toBeNull();
    expect(orderProgress("rejected", "pickup")).toBeNull();
  });

  it("does not report a step in progress as finished", () => {
    expect(progressPercent(orderProgress("preparing", "delivery")!)).toBeLessThan(100);
    expect(progressPercent(orderProgress("completed", "delivery")!)).toBe(100);
    expect(progressPercent(orderProgress("completed", "pickup")!)).toBe(100);
  });

  it("advances monotonically and distinctly along each journey", () => {
    for (const f of ["delivery", "pickup"] as const) {
      const steps = ORDER_FLOW[f].filter((s) => s !== "pending") as OrderStatus[];
      const pcts = steps.map((s) => progressPercent(orderProgress(s, f)!));
      expect(pcts).toEqual([...pcts].sort((a, b) => a - b));
      expect(new Set(pcts).size).toBe(pcts.length);
    }
  });

  it("agrees with the flow for every status on it", () => {
    for (const f of ["delivery", "pickup"] as const) {
      for (const s of ORDER_FLOW[f]) {
        expect(
          orderProgress(s as OrderStatus, f),
          `${f}/${s} must render a track`,
        ).not.toBeNull();
      }
    }
  });
});
