import { describe, it, expect } from "vitest";
import {
  money,
  subtotalOf,
  computeTotals,
  parseStockError,
} from "@/lib/order-math";

// These pin down the four behaviours that were reported as broken. Three of
// them were investigated against production and found already correct — the
// tests exist so they STAY correct.

describe("money()", () => {
  it("rounds to cents instead of leaking float error", () => {
    // 2.99 * 3 is 8.969999999999999 in IEEE754.
    expect(money(2.99 * 3)).toBe(8.97);
    expect(money(0.1 + 0.2)).toBe(0.3);
  });
});

describe("subtotalOf() — each line stands alone", () => {
  it("multiplies each line by its OWN quantity", () => {
    // The reported fear was quantities bleeding between products.
    const lines = [
      { unitPrice: 2.97, quantity: 1 },
      { unitPrice: 2.99, quantity: 2 },
    ];
    expect(subtotalOf(lines)).toBe(8.95); // 2.97 + 5.98 — the real order 39549c6e
  });

  it("keeps two lines of the same price independent", () => {
    expect(
      subtotalOf([
        { unitPrice: 5.98, quantity: 25 },
        { unitPrice: 5.98, quantity: 5 },
      ]),
    ).toBe(179.4);
  });

  it("is zero for an empty cart", () => {
    expect(subtotalOf([])).toBe(0);
  });
});

describe("computeTotals() — the invoice adds up", () => {
  const lines = [{ unitPrice: 10, quantity: 3 }]; // subtotal 30

  it("total equals subtotal when there is nothing else", () => {
    const t = computeTotals({ lines });
    expect(t.subtotal).toBe(30);
    expect(t.total).toBe(30);
  });

  it("subtotal always equals the sum of the lines", () => {
    const t = computeTotals({ lines, couponDiscount: 5, deliveryFee: 2 });
    expect(t.subtotal).toBe(subtotalOf(lines));
  });

  it("total = subtotal - discount + delivery", () => {
    const t = computeTotals({ lines, couponDiscount: 5, deliveryFee: 2 });
    expect(t.discount).toBe(5);
    expect(t.total).toBe(27); // 30 - 5 + 2
    expect(t.total).toBe(money(t.subtotal - t.discount + t.deliveryFee));
  });

  it("combines coupon and points into the stored discount", () => {
    const t = computeTotals({ lines, couponDiscount: 5, pointsDiscount: 4 });
    expect(t.discount).toBe(9);
    expect(t.net).toBe(21);
    expect(t.total).toBe(21);
  });

  it("caps points at what the coupon left, never going negative", () => {
    const t = computeTotals({ lines, couponDiscount: 25, pointsDiscount: 100 });
    expect(t.net).toBe(0);
    expect(t.total).toBe(0);
    expect(t.discount).toBe(30); // 25 coupon + only the 5 that were left
  });

  it("caps a coupon larger than the basket", () => {
    const t = computeTotals({ lines, couponDiscount: 999 });
    expect(t.discount).toBe(30);
    expect(t.total).toBe(0);
  });

  it("adds delivery AFTER discounts, so a coupon never eats the fee", () => {
    const t = computeTotals({ lines, couponDiscount: 999, deliveryFee: 3 });
    expect(t.net).toBe(0);
    expect(t.total).toBe(3);
  });

  it("holds cents exactly across a realistic basket", () => {
    const t = computeTotals({
      lines: [
        { unitPrice: 2.99, quantity: 3 },
        { unitPrice: 1.45, quantity: 2 },
      ],
      couponDiscount: 1.5,
      deliveryFee: 2.5,
    });
    expect(t.subtotal).toBe(11.87); // 8.97 + 2.90
    expect(t.total).toBe(12.87); // 11.87 - 1.50 + 2.50
  });

  it("scales to a large basket without drift", () => {
    const many = Array.from({ length: 200 }, () => ({
      unitPrice: 0.07,
      quantity: 3,
    }));
    const t = computeTotals({ lines: many });
    expect(t.subtotal).toBe(42); // 200 * 0.21
    expect(t.total).toBe(42);
  });
});

describe("parseStockError() — name the item that is short", () => {
  it("extracts the product name", () => {
    expect(parseStockError('insufficient_stock:صابون الكركم')).toBe(
      "صابون الكركم",
    );
  });

  it("handles a variant label", () => {
    expect(parseStockError("insufficient_stock:Shirt - Red / M")).toBe(
      "Shirt - Red / M",
    );
  });

  it("stops at a quote or newline from the wrapped driver error", () => {
    expect(parseStockError('insufficient_stock:Widget"\n at line 3')).toBe(
      "Widget",
    );
  });

  it("returns null when the error is a bare legacy one", () => {
    expect(parseStockError("insufficient_stock")).toBeNull();
  });

  it("returns null for an unrelated error", () => {
    expect(parseStockError("store_unavailable")).toBeNull();
  });
});
