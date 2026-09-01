// The gig-first → person-first resolver.
//
// The fixtures below are the REAL production rows, copied field for field:
// three gigs, all three belonging to one person ("باشن"), three different
// regions, every gallery empty, every rating null, every completed_count 0, and
// a profiles row carrying a name and nothing else. That is deliberate — the
// sparse state is the state this code actually runs in, so it is the state the
// tests are written against. A suite built on a rich fictional freelancer would
// pass while the only real profile on the platform rendered as empty boxes.

import { describe, it, expect } from "vitest";

import {
  aggregateRating,
  countLabel,
  gigToService,
  gigsToPortfolio,
  groupGigsByPerson,
  personToProfile,
  regionLabel,
  toProfessionalProfile,
  visiblePeopleFilters,
  type BrowsedGigRow,
  type ListerProfileRow,
} from "@/lib/data/freelance";
import { profileBlocks, startingPrice, hasRating } from "@/lib/professional";

function gig(over: Partial<BrowsedGigRow>): BrowsedGigRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    title: "",
    description: null,
    category: null,
    price: null,
    delivery_days: null,
    revisions: null,
    includes: null,
    image_url: null,
    gallery: null,
    region: null,
    created_at: "2026-07-29T19:00:00Z",
    available_until: null,
    completed_count: 0,
    rating_avg: null,
    rating_count: 0,
    freelancer_id: "8b6f9cdc-3100-4f4b-a2df-3cb3e7c1e80a",
    freelancer_name: "باشن",
    freelancer_avatar: null,
    freelancer_verified: false,
    freelancer_since: "2026-06-30T13:54:11Z",
    ...over,
  };
}

/** Production, 2026-09-01. Newest first, as `browse_gigs` returns them. */
const REAL_GIGS: BrowsedGigRow[] = [
  gig({
    id: "7659b474-c0d3-4201-ab26-7834105dac3f",
    title: "ممثل او موديل",
    category: "acting",
    // numeric() comes back from PostgREST as a string, not a number.
    price: "30.00",
    delivery_days: 1,
    region: "mountLebanon",
    image_url: "https://example.test/a.jpg",
    created_at: "2026-07-29T19:26:59Z",
  }),
  gig({
    id: "3716840f-16ea-4e51-a5c1-8b370abd3c4e",
    title: "تصوير احترافي",
    category: "photography",
    price: "30.00",
    delivery_days: 2,
    region: "south",
    image_url: "https://example.test/b.jpg",
    created_at: "2026-07-29T19:25:31Z",
  }),
  gig({
    id: "138fb16e-1282-4491-a547-9ed486b4acc4",
    title: "تصميم بوستات احترافية",
    category: "design",
    price: "5.00",
    delivery_days: 2,
    region: "north",
    image_url: "https://example.test/c.jpg",
    created_at: "2026-07-29T19:22:05Z",
  }),
];

const REAL_PROFILE: ListerProfileRow = {
  id: "8b6f9cdc-3100-4f4b-a2df-3cb3e7c1e80a",
  full_name: "باشن",
  avatar_url: null,
  bio: null,
  skills: null,
  gig_count: 3,
  languages: null,
  freelancer_verified: false,
  member_since: "2026-06-30T13:54:11Z",
};

const CATS: Record<string, string> = {
  design: "تصميم",
  photography: "تصوير",
  acting: "تمثيل وكومبارس",
};

describe("gigToService", () => {
  it("prices a gig as a floor, because that is what the form asks for", () => {
    const s = gigToService({
      id: "g",
      title: "t",
      price: "30.00",
      delivery_days: 2,
      revisions: 3,
    });
    expect(s.price).toEqual({ mode: "from", amount: 30 });
    expect(s.deliveryDays).toBe(2);
    expect(s.revisions).toBe(3);
  });

  it("has no price rather than a price of zero", () => {
    for (const price of [null, 0, "0.00"] as const) {
      const s = gigToService({ id: "g", title: "t", price, delivery_days: null });
      expect(s.price.mode).toBe("quote_required");
      expect(s.price.amount ?? null).toBeNull();
    }
  });

  it("turns a zero delivery or revision count into absent, never into 0", () => {
    const s = gigToService({
      id: "g",
      title: "t",
      price: "5",
      delivery_days: 0,
      revisions: 0,
    });
    expect(s.deliveryDays).toBeNull();
    expect(s.revisions).toBeNull();
  });
});

describe("aggregateRating", () => {
  it("returns nothing for the platform as it is — not 0.0", () => {
    expect(aggregateRating(REAL_GIGS)).toEqual({ ratingAvg: null, ratingCount: 0 });
    expect(hasRating(aggregateRating(REAL_GIGS))).toBe(false);
  });

  it("weights each service by its own count so one review cannot outvote forty", () => {
    const { ratingAvg, ratingCount } = aggregateRating([
      { rating_avg: 5, rating_count: 1 },
      { rating_avg: "4.20", rating_count: 40 },
    ]);
    expect(ratingCount).toBe(41);
    // (5·1 + 4.2·40) / 41 = 4.2195… → 4.22
    expect(ratingAvg).toBe(4.22);
  });

  it("ignores a rating_avg with no count behind it", () => {
    expect(aggregateRating([{ rating_avg: 5, rating_count: 0 }])).toEqual({
      ratingAvg: null,
      ratingCount: 0,
    });
  });
});

describe("gigsToPortfolio", () => {
  it("is empty when nobody has uploaded a sample — which is today", () => {
    expect(gigsToPortfolio(REAL_GIGS)).toEqual([]);
  });

  it("never marks a self-uploaded image as work done via Matjar", () => {
    const items = gigsToPortfolio([
      { id: "g1", title: "لوغو", gallery: ["one.jpg", "two.jpg"] },
    ]);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.viaMatjar === undefined)).toBe(true);
    expect(items[0].id).toBe("g1:0");
  });

  it("does not promote a service cover image into a portfolio", () => {
    // Every real gig has an image_url and an empty gallery. If covers counted,
    // this person would appear to have a three-piece portfolio they never made.
    expect(gigsToPortfolio(REAL_GIGS)).toHaveLength(0);
  });
});

describe("toProfessionalProfile — the one real freelancer", () => {
  const p = toProfessionalProfile(
    "8b6f9cdc-3100-4f4b-a2df-3cb3e7c1e80a",
    REAL_PROFILE,
    REAL_GIGS,
    "ar",
    CATS,
  );

  it("is one person with three services, not three adverts", () => {
    expect(p.kind).toBe("freelance");
    expect(p.name).toBe("باشن");
    expect(p.services).toHaveLength(3);
  });

  it("renders exactly the blocks it has something to say in", () => {
    expect(profileBlocks(p)).toEqual(["services", "area"]);
  });

  it("invents no rating, no completed count and no experience", () => {
    expect(p.ratingAvg).toBeNull();
    expect(p.ratingCount).toBe(0);
    expect(p.completedCount).toBeNull();
    expect(p.yearsExperience).toBeNull();
    expect(p.headline).toBeNull();
    expect(p.reviews).toEqual([]);
    expect(p.hours).toBeNull();
  });

  it("starts from the cheapest honest price, not from zero", () => {
    expect(startingPrice(p.services)).toBe(5);
  });

  it("localises the categories it shows as specialties", () => {
    // Raw keys here would put "design" and "acting" on an Arabic profile.
    // Most-listed first; each of these is listed once, so the tie falls to the
    // order they were posted in.
    expect(p.specialties).toEqual(["تصميم", "تصوير", "تمثيل وكومبارس"]);
  });

  it("covers the regions its services declare — areas, never an address", () => {
    expect(p.area.areas.sort()).toEqual(["الجنوب", "الشمال", "جبل لبنان"].sort());
    expect(p.area.region ?? null).toBeNull();
    expect(p.area.onSite).toBeUndefined();
    expect(p.area.remote).toBeUndefined();
  });

  it("claims no verification the platform has not done", () => {
    expect(p.trust).toEqual({ identityVerified: false });
  });

  it("orders services oldest-first so the list is stable between renders", () => {
    expect(p.services.map((s) => s.name)).toEqual([
      "تصميم بوستات احترافية",
      "تصوير احترافي",
      "ممثل او موديل",
    ]);
  });
});

describe("toProfessionalProfile — identity precedence", () => {
  it("prefers the profiles row over the denormalised gig copy", () => {
    const p = toProfessionalProfile(
      "u",
      { ...REAL_PROFILE, full_name: "الاسم الجديد" },
      [gig({ freelancer_name: "الاسم القديم" })],
      "ar",
    );
    expect(p.name).toBe("الاسم الجديد");
  });

  it("falls back to the gig copy only when the profile row is unreachable", () => {
    const p = toProfessionalProfile("u", null, [gig({ freelancer_name: "باشن" })], "ar");
    expect(p.name).toBe("باشن");
  });

  it("treats a blank profile name as absent, not as an empty name", () => {
    const p = toProfessionalProfile(
      "u",
      { ...REAL_PROFILE, full_name: "   " },
      [gig({ freelancer_name: "باشن" })],
      "ar",
    );
    expect(p.name).toBe("باشن");
  });
});

describe("groupGigsByPerson", () => {
  const people = groupGigsByPerson(REAL_GIGS);

  it("collapses the whole marketplace into the one person who is in it", () => {
    expect(people).toHaveLength(1);
    expect(people[0].gigs).toHaveLength(3);
  });

  it("carries the cheapest price, every category and every region", () => {
    expect(people[0].fromPrice).toBe(5);
    expect(people[0].categories).toEqual(["acting", "photography", "design"]);
    expect(people[0].regionKeys).toEqual(["mountLebanon", "south", "north"]);
    expect(people[0].covers).toHaveLength(3);
  });

  it("shows no evidence it does not have", () => {
    expect(people[0].ratingAvg).toBeNull();
    expect(people[0].ratingCount).toBe(0);
    expect(people[0].completedCount).toBeNull();
  });

  it("keeps the RPC's ranking by taking first-appearance order", () => {
    // browse_gigs sorts verified → available → completed → newest. Re-sorting
    // in JS would throw that away; grouping must not.
    const rows = [
      gig({ id: "1", freelancer_id: "second-seen" }),
      gig({ id: "2", freelancer_id: "first-seen" }),
      gig({ id: "3", freelancer_id: "second-seen" }),
    ];
    expect(groupGigsByPerson(rows).map((p) => p.id)).toEqual([
      "second-seen",
      "first-seen",
    ]);
  });
});

describe("personToProfile", () => {
  it("gives the card the same shape the profile page renders", () => {
    const [person] = groupGigsByPerson(REAL_GIGS);
    const p = personToProfile(person, "ar", CATS);
    expect(p.name).toBe("باشن");
    expect(p.services).toHaveLength(3);
    expect(startingPrice(p.services)).toBe(5);
    // The list payload genuinely has no bio or skills; the card shows less than
    // the profile rather than filling the gap in.
    expect(p.bio).toBeNull();
    expect(p.skills).toEqual([]);
  });
});

describe("visiblePeopleFilters", () => {
  const facets = {
    verified: 0,
    available: 0,
    categories: { design: 1, photography: 1, acting: 1 },
    regions: { north: 1, south: 1, mountLebanon: 1 },
  };

  it("offers only the filters that can split today's list", () => {
    expect(visiblePeopleFilters({ people: 1, facets })).toEqual([
      "category",
      "region",
    ]);
  });

  it("never offers a control that would empty the page", () => {
    // One person, and they are verified: "verified only" keeps everyone or
    // nobody. Neither is a filter.
    const f = visiblePeopleFilters({
      people: 1,
      facets: { ...facets, verified: 3, available: 3 },
    });
    expect(f).not.toContain("verified");
    expect(f).not.toContain("available");
  });

  it("turns those two on as soon as there is a second person to separate", () => {
    const f = visiblePeopleFilters({
      people: 2,
      facets: { ...facets, verified: 1, available: 1 },
    });
    expect(f).toContain("verified");
    expect(f).toContain("available");
  });

  it("hides a single-valued facet, which cannot narrow anything", () => {
    expect(
      visiblePeopleFilters({
        people: 5,
        facets: { categories: { design: 9 }, regions: { north: 9 } },
      }),
    ).toEqual([]);
  });
});

describe("countLabel", () => {
  // The Arabic forms as they ship. These are the strings that go on screen.
  const services = {
    one: "خدمة وحدة",
    two: "خدمتين",
    few: "{n} خدمات",
    many: "{n} خدمة",
  };

  it("gets the two numbers actually on screen today right", () => {
    // One freelancer, three services — and "1 مستقل" / "3 خدمة" are exactly the
    // two forms a naive "{n} خدمة" template renders wrong.
    expect(countLabel(services, 3)).toBe("3 خدمات");
    expect(
      countLabel(
        { one: "مستقل واحد", two: "مستقلّين", few: "{n} مستقلّين", many: "{n} مستقل" },
        1,
      ),
    ).toBe("مستقل واحد");
  });

  it("drops the numeral entirely for the dual, as Arabic does", () => {
    expect(countLabel(services, 2)).toBe("خدمتين");
  });

  it("returns to the singular above ten", () => {
    expect(countLabel(services, 11)).toBe("11 خدمة");
    expect(countLabel(services, 99)).toBe("99 خدمة");
  });

  it("follows the hundreds rule rather than the raw magnitude", () => {
    // 103 % 100 = 3 → plural; 100 → singular.
    expect(countLabel(services, 103)).toBe("103 خدمات");
    expect(countLabel(services, 100)).toBe("100 خدمة");
  });

  it("leaves an English form alone whatever the count", () => {
    const en = {
      one: "1 service",
      two: "2 services",
      few: "{n} services",
      many: "{n} services",
    };
    expect([1, 2, 3, 11].map((n) => countLabel(en, n))).toEqual([
      "1 service",
      "2 services",
      "3 services",
      "11 services",
    ]);
  });
});

describe("regionLabel", () => {
  it("reads the catalogue rather than a second copy in the dictionary", () => {
    expect(regionLabel("north", "ar")).toBe("الشمال");
    expect(regionLabel("north", "en")).toBe("North");
    expect(regionLabel(null, "ar")).toBeNull();
    // An unknown key echoes rather than rendering "undefined".
    expect(regionLabel("atlantis", "ar")).toBe("atlantis");
  });
});
