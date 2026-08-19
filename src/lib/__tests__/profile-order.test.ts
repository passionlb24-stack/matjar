import { describe, it, expect } from "vitest";
import { categoryKeys } from "@/lib/catalog";
import {
  DEFAULT_PROFILE_ORDER,
  resolveProfileOrder,
  sectorHasTeam,
  resolveStoreModules,
  type ProfileSectionKey,
} from "@/lib/sectors";

// The whole point of this resolver is that it cannot lose a section. A hand
// written per-sector order is exactly the kind of list somebody edits in a hurry,
// and the failure it invites — a storefront quietly missing its reviews — is
// invisible until a merchant complains. These tests exist to make that
// impossible rather than unlikely.
describe("profile section order", () => {
  it("renders every section for every sector, with nothing dropped", () => {
    for (const category of categoryKeys) {
      const order = resolveProfileOrder(category);
      expect(
        [...DEFAULT_PROFILE_ORDER].sort(),
        `sector ${category} is missing a section`,
      ).toEqual([...order].sort());
    }
  });

  it("never renders the same section twice", () => {
    for (const category of categoryKeys) {
      const order = resolveProfileOrder(category);
      expect(new Set(order).size, `sector ${category} repeats a section`).toBe(
        order.length,
      );
    }
  });

  it("keeps identity at the top for every sector", () => {
    for (const category of categoryKeys) {
      expect(resolveProfileOrder(category).slice(0, 3)).toEqual([
        "announcement",
        "hero",
        "header",
      ]);
    }
  });

  it("puts what the customer came for above the generic catalogue", () => {
    // The specific regressions this was built to fix, stated as expectations
    // rather than as a comment nobody re-reads.
    const before = (
      category: Parameters<typeof resolveProfileOrder>[0],
      a: ProfileSectionKey,
      b: ProfileSectionKey,
    ) => {
      const o = resolveProfileOrder(category);
      return o.indexOf(a) < o.indexOf(b);
    };

    expect(before("healthcare", "doctors", "catalog")).toBe(true);
    expect(before("beauty", "portfolio", "catalog")).toBe(true);
    expect(before("hospitality", "stay", "catalog")).toBe(true);
    expect(before("fitness", "classes", "catalog")).toBe(true);
    expect(before("events", "tickets", "catalog")).toBe(true);
    expect(before("contractors", "portfolio", "catalog")).toBe(true);
    expect(before("food", "catalog", "reviews")).toBe(true);
  });

  it("leads the goods sectors with what they sell", () => {
    // These three used to have no composition, so they inherited a default in
    // which the catalogue sat eighteenth — below branches, delivery, the map,
    // the hours and nine sections that render nothing for a shop. The same
    // defect as the clinic's, and it lasted longer only because retail was the
    // fallback everything else was compared against.
    for (const sector of ["retail", "pharmacy", "farm"] as const) {
      const order = resolveProfileOrder(sector);
      // Straight after the identity block — nothing between the name and the goods.
      expect(order.indexOf("catalog"), `${sector} buries its catalogue`).toBe(3);
      expect(order.indexOf("catalog")).toBeLessThan(order.indexOf("location"));
      expect(order.indexOf("catalog")).toBeLessThan(order.indexOf("branches"));
    }
  });

  it("still falls back to the default for any sector left unconfigured", () => {
    // The fallback is the safety net, not a sector's design. Asserted on the
    // resolver itself so it keeps holding once every sector has a composition.
    const unknown = "not_a_sector" as unknown as Parameters<
      typeof resolveProfileOrder
    >[0];
    expect(resolveProfileOrder(unknown)).toEqual(DEFAULT_PROFILE_ORDER);
  });
});

describe("sectorHasTeam honours the store's own switch", () => {
  it("follows the resolved modules when they are given", () => {
    // healthcare has `team` by default; a clinic that switches it off should not
    // be told it has a team. This override was silently ignored before.
    const off = resolveStoreModules("healthcare", { team: false });
    expect(sectorHasTeam("healthcare", off)).toBe(false);

    // and retail, which has no team by default, should get one if it asks.
    const on = resolveStoreModules("retail", { team: true });
    expect(sectorHasTeam("retail", on)).toBe(true);
  });

  it("falls back to the sector default when no store is in hand", () => {
    expect(sectorHasTeam("healthcare")).toBe(true);
    expect(sectorHasTeam("retail")).toBe(false);
  });
});
