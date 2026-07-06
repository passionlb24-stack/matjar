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
