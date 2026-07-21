import { describe, it, expect } from "vitest";
import { computeProfit, computePrice } from "@/lib/hub-calc";

describe("computeProfit", () => {
  it("computes profit, margin and markup for cost 10, price 15, qty 3", () => {
    const r = computeProfit(10, 15, 3);
    expect(r.unit).toBe(5);
    expect(r.margin).toBeCloseTo(33.333, 2);
    expect(r.markup).toBe(50);
    expect(r.revenue).toBe(45);
    expect(r.profit).toBe(15);
    expect(r.loss).toBe(false);
  });

  it("flags a loss when price is below cost", () => {
    const r = computeProfit(20, 12, 1);
    expect(r.unit).toBe(-8);
    expect(r.loss).toBe(true);
  });

  it("treats qty < 1 as 1 and avoids divide-by-zero", () => {
    const r = computeProfit(0, 10, 0);
    expect(r.revenue).toBe(10);
    expect(r.markup).toBe(0); // cost 0 → guarded, not Infinity
  });
});

describe("computePrice", () => {
  it("prices a 10 cost at a 30% margin", () => {
    const r = computePrice(10, 30, 0)!;
    expect(r.final).toBeCloseTo(14.2857, 3);
    expect(r.profit).toBeCloseTo(4.2857, 3);
  });

  it("adds pass-through fees/tax on top of the margin price", () => {
    const r = computePrice(10, 30, 11)!;
    // base 14.2857 * 1.11
    expect(r.final).toBeCloseTo(15.857, 2);
    expect(r.profit).toBeCloseTo(4.2857, 3); // profit is the margin part only
  });

  it("rejects invalid margins (>=100) and non-positive cost", () => {
    expect(computePrice(10, 100, 0)).toBeNull();
    expect(computePrice(0, 30, 0)).toBeNull();
  });
});
