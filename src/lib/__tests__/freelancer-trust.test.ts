import { describe, it, expect } from "vitest";
import {
  isAvailable,
  trustChips,
  visibleSections,
  visibleFilters,
  type GigTrustInput,
} from "@/lib/freelancer-trust";

const TODAY = "2026-08-04";

// A gig as it exists in the section right now: no rating, no completed jobs.
const NEW_GIG: GigTrustInput = {
  ratingAvg: null,
  ratingCount: 0,
  completedCount: 0,
  availableUntil: "2026-08-10",
  deliveryDays: 3,
  revisions: 2,
  gallery: ["a", "b", "c", "d"],
  region: "طرابلس",
};

describe("isAvailable", () => {
  it("is false without a date — availability is claimed, not assumed", () => {
    expect(isAvailable(null, TODAY)).toBe(false);
    expect(isAvailable(undefined, TODAY)).toBe(false);
  });

  it("holds through the last day and lapses after it", () => {
    expect(isAvailable("2026-08-04", TODAY)).toBe(true);
    expect(isAvailable("2026-08-05", TODAY)).toBe(true);
    expect(isAvailable("2026-08-03", TODAY)).toBe(false);
  });
});

describe("trustChips — never a zero", () => {
  // The whole reason this module exists.
  it("shows no rating chip when nothing has been rated", () => {
    const chips = trustChips(NEW_GIG, TODAY);
    expect(chips.find((c) => c.kind === "rating")).toBeUndefined();
  });

  it("shows no completed chip at zero jobs", () => {
    const chips = trustChips(NEW_GIG, TODAY);
    expect(chips.find((c) => c.kind === "completed")).toBeUndefined();
  });

  // rating_avg is nullable precisely so this cannot happen; pin it anyway,
  // because a 0 here renders as a one-star service.
  it("treats a 0 rating with no ratings as no evidence, not one star", () => {
    const chips = trustChips({ ...NEW_GIG, ratingAvg: 0, ratingCount: 0 }, TODAY);
    expect(chips.find((c) => c.kind === "rating")).toBeUndefined();
  });

  it("fills the slot with declared trust instead of leaving it empty", () => {
    const chips = trustChips(NEW_GIG, TODAY);
    expect(chips).toHaveLength(3);
    expect(chips.map((c) => c.kind)).toEqual(["available", "delivery", "revisions"]);
  });
});

describe("trustChips — earned outranks declared", () => {
  it("gives the slot to a rating the moment one exists", () => {
    const chips = trustChips({ ...NEW_GIG, ratingAvg: 4.9, ratingCount: 11 }, TODAY);
    expect(chips[0]).toEqual({ kind: "rating", rating: 4.9, count: 11 });
  });

  it("puts jobs completed ahead of any promise the seller made", () => {
    const chips = trustChips({ ...NEW_GIG, completedCount: 23 }, TODAY);
    expect(chips[0]).toEqual({ kind: "completed", count: 23 });
  });

  it("ranks a stranger's verdict above the seller's own count", () => {
    const chips = trustChips(
      { ...NEW_GIG, ratingAvg: 5, ratingCount: 47, completedCount: 68 },
      TODAY,
    );
    expect(chips[0].kind).toBe("rating");
    expect(chips[1].kind).toBe("completed");
  });
});

describe("trustChips — degrading gracefully", () => {
  it("falls back to region when a gig has nothing else", () => {
    expect(trustChips({ region: "بعلبك" }, TODAY)).toEqual([
      { kind: "region", region: "بعلبك" },
    ]);
  });

  it("returns nothing rather than something invented", () => {
    expect(trustChips({}, TODAY)).toEqual([]);
    expect(trustChips({ region: "   " }, TODAY)).toEqual([]);
  });

  it("drops an expired availability claim", () => {
    const chips = trustChips({ ...NEW_GIG, availableUntil: "2026-07-01" }, TODAY);
    expect(chips.find((c) => c.kind === "available")).toBeUndefined();
  });

  // One image is a thumbnail. Calling it a portfolio cheapens the slot.
  it("counts a gallery as evidence only from three samples up", () => {
    const two = trustChips({ gallery: ["a", "b"], region: "صيدا" }, TODAY);
    expect(two.find((c) => c.kind === "samples")).toBeUndefined();
    const three = trustChips({ gallery: ["a", "b", "c"] }, TODAY);
    expect(three[0]).toEqual({ kind: "samples", count: 3 });
  });

  it("never exceeds the slot", () => {
    const loaded: GigTrustInput = {
      ratingAvg: 5, ratingCount: 40, completedCount: 60,
      availableUntil: "2026-09-01", deliveryDays: 2, revisions: 3,
      gallery: ["a", "b", "c"], region: "بيروت",
    };
    expect(trustChips(loaded, TODAY)).toHaveLength(3);
    expect(trustChips(loaded, TODAY, 5)).toHaveLength(5);
  });
});

describe("visibleSections", () => {
  // Today: 3 gigs. Six headers over five empty rows would say "empty market".
  it("shows a single grid instead of sections while the section is small", () => {
    expect(visibleSections({ total: 3, available: 3, rated: 0 })).toEqual([]);
    expect(visibleSections({ total: 19, available: 19, rated: 0 })).toEqual([]);
  });

  it("opens with the sections that work without a single completed job", () => {
    expect(visibleSections({ total: 30, available: 8, rated: 0 })).toEqual([
      "available",
      "nearby",
      "new",
    ]);
  });

  it("withholds availability until it can fill a row", () => {
    expect(visibleSections({ total: 30, available: 2, rated: 0 })).toEqual([
      "nearby",
      "new",
    ]);
  });

  it("adds the rating-led sections once ratings exist", () => {
    expect(visibleSections({ total: 60, available: 10, rated: 12 })).toEqual([
      "available",
      "nearby",
      "new",
      "topRated",
      "mostHired",
    ]);
  });
});

describe("visibleFilters", () => {
  it("offers nothing to filter when everything is in one bucket", () => {
    expect(
      visibleFilters({ total: 3, categories: { design: 3 }, regions: { beirut: 3 } }),
    ).toEqual([]);
  });

  it("offers a filter as soon as it can actually split the list", () => {
    expect(
      visibleFilters({
        total: 3,
        categories: { design: 2, video: 1 },
        regions: { tripoli: 2, beirut: 1 },
      }),
    ).toEqual(["category", "region"]);
  });

  it("holds price and delivery back until the list is long enough to need them", () => {
    const small = visibleFilters({ total: 7, verified: 1, available: 1 });
    expect(small).not.toContain("price");
    const bigger = visibleFilters({ total: 8, verified: 1, available: 1 });
    expect(bigger).toContain("price");
    expect(bigger).toContain("delivery");
  });

  it("hides verified-only while nobody is verified", () => {
    expect(visibleFilters({ total: 20, verified: 0 })).not.toContain("verified");
    expect(visibleFilters({ total: 20, verified: 1 })).toContain("verified");
  });
});
