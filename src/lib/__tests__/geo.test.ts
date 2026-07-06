import { describe, it, expect } from "vitest";
import { distanceKm } from "@/lib/geo";

describe("distanceKm (Haversine)", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(33.8938, 35.5018, 33.8938, 35.5018)).toBe(0);
  });

  it("computes Beirut -> Tripoli at roughly 67 km", () => {
    // Beirut (33.8938, 35.5018) -> Tripoli (34.4367, 35.8497)
    const d = distanceKm(33.8938, 35.5018, 34.4367, 35.8497);
    expect(d).toBeGreaterThan(60);
    expect(d).toBeLessThan(75);
  });

  it("is symmetric", () => {
    const ab = distanceKm(33.9, 35.5, 34.4, 35.8);
    const ba = distanceKm(34.4, 35.8, 33.9, 35.5);
    expect(ab).toBeCloseTo(ba, 6);
  });
});
