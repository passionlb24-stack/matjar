import { describe, expect, it } from "vitest";
import {
  MIN_NAV_ITEMS,
  MIN_RAIL_ITEMS,
  hasEnough,
  railOnlyIfEnough,
} from "@/lib/rail";

// The regression these exist for: navigation reused the rail's threshold, so a
// section with two real job postings vanished from the header. The owner found
// out by noticing the gap — nothing told him, and nothing told a customer the
// jobs existed. Three is a minimum for a horizontal scroller. It is not a
// minimum for a link.

describe("navigation gating", () => {
  it("keeps a section that has anything real behind it", () => {
    // The exact case that regressed: 2 live job postings.
    expect(hasEnough(2)).toBe(true);
    expect(hasEnough(1)).toBe(true);
  });

  it("hides only a genuine dead end", () => {
    // crafts, wholesale and delivery are all at 0 in production. Those are the
    // links the gate was written for.
    expect(hasEnough(0)).toBe(false);
  });

  it("does not borrow the rail's visual minimum", () => {
    // If these ever collapse back to one constant, a two-item section starts
    // disappearing from the header again.
    expect(MIN_NAV_ITEMS).toBeLessThan(MIN_RAIL_ITEMS);
    expect(MIN_NAV_ITEMS).toBe(1);
  });
});

describe("rail gating is unchanged", () => {
  it("still needs three cards to promise 'there is more here'", () => {
    expect(railOnlyIfEnough(2)).toBe("hidden lg:block");
    expect(railOnlyIfEnough(3)).toBe("");
  });

  it("hides a thin rail on phones only, never on desktop", () => {
    // A two-card grid in a four-column desktop row still reads as deliberate,
    // which is why this one is breakpoint-scoped and the nav gate is not.
    expect(railOnlyIfEnough(1)).toContain("lg:block");
  });
});
