import { describe, it, expect } from "vitest";
import { formatUsd, formatLbp } from "@/lib/currency";

describe("formatUsd", () => {
  it("formats small amounts without a separator", () => {
    expect(formatUsd(50)).toBe("$50");
    expect(formatUsd(999)).toBe("$999");
  });
  it("adds a thousands separator at >= 1000", () => {
    expect(formatUsd(1000)).toBe("$1,000");
    expect(formatUsd(165000)).toBe("$165,000");
  });
  it("handles zero", () => {
    expect(formatUsd(0)).toBe("$0");
  });
  it("is unchanged when opts is absent or cents is falsy", () => {
    expect(formatUsd(1234.5, {})).toBe("$1,234.5");
    expect(formatUsd(1234.5, { cents: false })).toBe(formatUsd(1234.5));
  });
});

describe("formatUsd with { cents: true }", () => {
  // Pins the exact strings the invoice / POS / supplier / merchant-dashboard
  // screens have always rendered. These five surfaces each carried their own
  // copy of this arithmetic (MP-061); the option replaced the copies, so any
  // drift here is a visible change to a merchant's money screen.
  it("rounds to at most two decimals", () => {
    expect(formatUsd(1234.5678, { cents: true })).toBe("$1,234.57");
    expect(formatUsd(7.399999, { cents: true })).toBe("$7.4");
    expect(formatUsd(0.005, { cents: true })).toBe("$0.01");
  });
  it("drops trailing zeros, as the copies it replaced did", () => {
    expect(formatUsd(12.5, { cents: true })).toBe("$12.5");
    expect(formatUsd(12.0, { cents: true })).toBe("$12");
    expect(formatUsd(0, { cents: true })).toBe("$0");
  });
  it("groups thousands", () => {
    expect(formatUsd(1000, { cents: true })).toBe("$1,000");
    expect(formatUsd(1_000_000, { cents: true })).toBe("$1,000,000");
  });
  it("differs from the default only by that rounding", () => {
    // Whole and 1-2dp amounts — the overwhelming majority — render identically,
    // which is why adopting the option changed nothing on screen.
    for (const v of [0, 5, 50, 999, 1000, 165000, 7.5]) {
      expect(formatUsd(v, { cents: true })).toBe(formatUsd(v));
    }
    // Only >2dp amounts diverge, and that divergence is the point.
    expect(formatUsd(1234.5678, { cents: true })).not.toBe(formatUsd(1234.5678));
  });
});

describe("formatLbp", () => {
  it("returns an approximate LBP string in Arabic", () => {
    expect(formatLbp(10, 89000, "ar")).toBe("≈ 890,000 ل.ل.");
  });
  it("uses the LBP label in English", () => {
    expect(formatLbp(10, 89000, "en")).toBe("≈ 890,000 LBP");
  });
  it("returns empty string when the rate is missing or amount non-positive", () => {
    expect(formatLbp(10, 0, "ar")).toBe("");
    expect(formatLbp(0, 89000, "ar")).toBe("");
    expect(formatLbp(-5, 89000, "ar")).toBe("");
  });
  it("rounds to the nearest whole LBP", () => {
    expect(formatLbp(1.5, 89000, "en")).toBe("≈ 133,500 LBP");
  });
});
