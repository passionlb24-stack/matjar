import { describe, it, expect } from "vitest";
import { computeCompleteness, type StoreFacts } from "@/lib/completeness";
import { resolveStoreModules } from "@/lib/sectors";

const EMPTY: StoreFacts = {
  logo: false,
  cover: false,
  description: false,
  hours: false,
  whatsapp: false,
  mapPin: false,
  brandColor: false,
  customLink: false,
  offerings: 0,
  offeringsWithCost: 0,
  providers: 0,
};

const FULL: StoreFacts = {
  logo: true,
  cover: true,
  description: true,
  hours: true,
  whatsapp: true,
  mapPin: true,
  brandColor: true,
  customLink: true,
  offerings: 10,
  offeringsWithCost: 10,
  providers: 2,
};

const retail = resolveStoreModules("retail");
const healthcare = resolveStoreModules("healthcare");

describe("completeness score", () => {
  it("is 0 for an empty store and 100 for a finished one", () => {
    expect(computeCompleteness("retail", retail, EMPTY).score).toBe(0);
    expect(computeCompleteness("retail", retail, FULL).score).toBe(100);
  });

  it("weights by what skipping it costs, not by counting fields", () => {
    // A cover (12) must move the score more than a brand colour (3). Counting
    // fields equally is what makes a completeness number worth ignoring.
    const cover = computeCompleteness("retail", retail, { ...EMPTY, cover: true });
    const colour = computeCompleteness("retail", retail, { ...EMPTY, brandColor: true });
    expect(cover.score).toBeGreaterThan(colour.score);
  });

  it("names one next action, and it is the heaviest thing undone", () => {
    const c = computeCompleteness("retail", retail, EMPTY);
    // products carries the most weight of anything a brand-new shop lacks.
    expect(c.next?.key).toBe("products");
    expect(c.next?.done).toBe(false);
  });

  it("returns no next action once everything is done", () => {
    expect(computeCompleteness("retail", retail, FULL).next).toBeNull();
  });
});

describe("publish readiness is a different question from completeness", () => {
  it("can be highly complete and still not publishable", () => {
    // Everything cosmetic done, the one required thing missing.
    const facts: StoreFacts = { ...FULL, cover: false };
    const c = computeCompleteness("retail", retail, facts);
    expect(c.score).toBeGreaterThan(80);
    expect(c.readyToPublish).toBe(false);
    expect(c.missingRequired.map((i) => i.key)).toContain("cover");
  });

  it("is publishable when every required item is present, cosmetics or not", () => {
    const facts: StoreFacts = { ...FULL, brandColor: false, customLink: false, logo: false };
    const c = computeCompleteness("retail", retail, facts);
    expect(c.readyToPublish).toBe(true);
    expect(c.score).toBeLessThan(100);
  });
});

describe("requirements follow the sector's actual modules", () => {
  it("asks a clinic for its doctors and blocks publishing without them", () => {
    const c = computeCompleteness("healthcare", healthcare, { ...FULL, providers: 0 });
    expect(c.missingRequired.map((i) => i.key)).toContain("team");
    expect(c.readyToPublish).toBe(false);
  });

  it("never asks a retail shop for a team", () => {
    const c = computeCompleteness("retail", retail, EMPTY);
    expect(c.items.map((i) => i.key)).not.toContain("team");
  });

  it("asks for a map pin wherever location is on — the gap 8 of 13 live stores have", () => {
    const c = computeCompleteness("retail", retail, EMPTY);
    expect(c.missingRequired.map((i) => i.key)).toContain("mapPin");
  });

  it("does not nag a store that switched location off", () => {
    const noLocation = resolveStoreModules("retail", { location: false });
    const c = computeCompleteness("retail", noLocation, EMPTY);
    expect(c.items.map((i) => i.key)).not.toContain("mapPin");
  });
});

describe("cost prices", () => {
  it("is not asked of a shop with nothing to price", () => {
    const c = computeCompleteness("retail", retail, EMPTY);
    expect(c.items.map((i) => i.key)).not.toContain("costPrices");
  });

  it("is asked once there is a catalogue, and is not all-or-nothing", () => {
    const most = computeCompleteness("retail", retail, {
      ...FULL,
      offerings: 10,
      offeringsWithCost: 8,
    });
    expect(most.items.find((i) => i.key === "costPrices")?.done).toBe(true);

    // The live platform: 60 products, 0 priced. The profit report reads zero.
    const none = computeCompleteness("retail", retail, {
      ...FULL,
      offerings: 60,
      offeringsWithCost: 0,
    });
    expect(none.items.find((i) => i.key === "costPrices")?.done).toBe(false);
    // Missing margins must never block a shop from trading.
    expect(none.readyToPublish).toBe(true);
  });
});

describe("sectors whose primary entity is not products", () => {
  it("never asks a hotel for cost prices it cannot record", () => {
    // `offerings` is units here while cost price lives on `products`, so the
    // item could never be satisfied — and a permanently undone step teaches a
    // merchant the whole checklist is noise.
    const hospitality = resolveStoreModules("hospitality");
    const c = computeCompleteness(
      "hospitality",
      hospitality,
      { ...FULL, offerings: 6, offeringsWithCost: 0 },
      { key: "units", href: "units" },
    );
    expect(c.items.map((i) => i.key)).not.toContain("costPrices");
    expect(c.score).toBe(100);
  });

  it("relabels and relinks the primary step", () => {
    const hospitality = resolveStoreModules("hospitality");
    const c = computeCompleteness("hospitality", hospitality, EMPTY, {
      key: "units",
      href: "units",
    });
    const keys = c.items.map((i) => i.key);
    expect(keys).toContain("units");
    expect(keys).not.toContain("products");
    expect(c.items.find((i) => i.key === "units")?.href).toBe("units");
  });
});
