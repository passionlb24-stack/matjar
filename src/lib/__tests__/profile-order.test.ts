import { describe, it, expect, vi, afterEach } from "vitest";
import {
  categoryKeys,
  isCategoryKey,
  toCategoryKey,
  categoryGroup,
} from "@/lib/catalog";
import {
  DEFAULT_PROFILE_ORDER,
  resolveProfileOrder,
  sectorHasTeam,
  sectorTeamMeta,
  resolveStoreModules,
  SECTOR_TEAM_META,
  type ProfileSectionKey,
} from "@/lib/sectors";
import ar from "@/i18n/dictionaries/ar.json";
import en from "@/i18n/dictionaries/en.json";

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

// The roster module is keyed `doctors` because that is what its table, its route
// and its RPCs are called. That key used to reach the screen: a hair salon's
// staff were listed as the clinic's word, under a stethoscope. The word and the
// glyph now come from the sector, and these tests are what stop the next sector
// from silently inheriting "doctors" again — a sector added without a team label
// must fail here, not ship.
describe("every sector names its own team", () => {
  const dicts = { ar, en } as const;

  it("has a label and an icon for every sector, with no gaps", () => {
    for (const category of categoryKeys) {
      const meta = SECTOR_TEAM_META[category];
      expect(meta, `sector ${category} has no team label/icon`).toBeDefined();
      expect(typeof meta.labelKey, `sector ${category} label key`).toBe(
        "string",
      );
      expect(meta.Icon, `sector ${category} team icon`).toBeTruthy();
    }
    // Nothing extra either: an entry for a category that no longer exists is a
    // label nobody will ever see and a rename nobody will notice.
    expect(Object.keys(SECTOR_TEAM_META).sort()).toEqual(
      [...categoryKeys].sort(),
    );
  });

  it("resolves that label in BOTH locales", () => {
    // The merchant sidebar, the roster screen and the storefront heading all
    // read `os.team[labelKey]`. A key that exists in one dictionary and not the
    // other renders as blank on the other locale's page.
    for (const category of categoryKeys) {
      const { labelKey } = sectorTeamMeta(category);
      for (const [locale, dict] of Object.entries(dicts)) {
        const label = (dict.os.team as Record<string, string>)[labelKey];
        expect(
          label,
          `sector ${category} has no ${locale} label for "${labelKey}"`,
        ).toBeTruthy();
      }
    }
  });

  it("does not call a salon, a gym or a school's people doctors", () => {
    // The specific defect, stated so it cannot come back by accident. Only a
    // clinic gets the clinic's word.
    expect(sectorTeamMeta("healthcare").labelKey).toBe("doctors");
    for (const category of categoryKeys) {
      if (category === "healthcare") continue;
      expect(
        sectorTeamMeta(category).labelKey,
        `sector ${category} still labels its team as doctors`,
      ).not.toBe("doctors");
    }
    // …and the stethoscope belongs to the clinic too.
    const clinicIcon = SECTOR_TEAM_META.healthcare.Icon;
    for (const category of ["beauty", "fitness", "education", "petCare", "professional"] as const) {
      expect(
        SECTOR_TEAM_META[category].Icon,
        `sector ${category} still shows the clinic's icon`,
      ).not.toBe(clinicIcon);
    }
  });

  it("still answers for a category that is not in the registry", () => {
    // A store row whose business_type slug drifted should render a plain team
    // section, not throw on a public page.
    const unknown = "not_a_sector" as unknown as (typeof categoryKeys)[number];
    expect(sectorTeamMeta(unknown).labelKey).toBe("team");
  });
});

// MJ-022. Everything above is keyed on a CategoryKey, and the value that
// actually arrives is `business_types.slug` — a string an admin types into a
// form. The entry point is guarded (business-type-manager.tsx refuses a slug
// outside categoryKeys and disables submit) and RLS lets only a `types` admin
// write the table at all, so a bad row is hard to create. It is not impossible:
// the allow-list is client-side, and rows predating it, renames, and direct SQL
// all bypass it. What must therefore hold is the step AFTER: an unrecognised
// slug is narrowed rather than asserted, so it renders the generic sector and
// says so, instead of travelling on with the type of a sector it is not.
describe("a business type slug is checked, not asserted", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts exactly the sectors the registry knows", () => {
    for (const category of categoryKeys) {
      expect(isCategoryKey(category), `${category} rejected`).toBe(true);
      expect(toCategoryKey(category)).toBe(category);
    }
    // The set is the same one the admin screen's allow-list and its unmapped
    // banner are built from, so the three cannot drift apart.
    expect([...categoryKeys].sort()).toEqual(Object.keys(categoryGroup).sort());
  });

  it("rejects anything else, including the shapes a DB column really produces", () => {
    for (const value of [
      "lab", // the sector this branch decided not to half-add
      "Retail", // case drift
      "retail ", // whitespace an admin pasted
      "",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(isCategoryKey(value), `${String(value)} accepted`).toBe(false);
    }
  });

  it("falls back to the generic sector rather than throwing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toCategoryKey("lab")).toBe("retail");
    expect(toCategoryKey(null)).toBe("retail");
    expect(toCategoryKey(undefined)).toBe("retail");
  });

  it("says so, once, when it falls back on a real value", () => {
    // The point of the fallback is that a drifted row renders a plain shop
    // instead of a 500. The point of the WARNING is that somebody finds out —
    // a default nobody ever hears about is indistinguishable from a decision.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    toCategoryKey("lab", "store abc");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("lab");
    expect(warn.mock.calls[0][0]).toContain("store abc");

    // …but a missing business type is an absence, not a drift. A store with no
    // type row must not spam the log on every render.
    warn.mockClear();
    toCategoryKey(null, "store abc");
    toCategoryKey(undefined, "store abc");
    toCategoryKey("", "store abc");
    expect(warn).not.toHaveBeenCalled();
  });

  it("resolves the whole registry for a slug it had to fall back on", () => {
    // The fallback is only worth having if what it returns is a complete
    // sector. `retail` must answer every registry question, or the narrowing
    // has just moved the crash one call further down.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const category = toCategoryKey("lab");
    expect(resolveProfileOrder(category).sort()).toEqual(
      [...DEFAULT_PROFILE_ORDER].sort(),
    );
    expect(SECTOR_TEAM_META[category]).toBeDefined();
    expect(resolveStoreModules(category).size).toBeGreaterThan(0);
  });
});
