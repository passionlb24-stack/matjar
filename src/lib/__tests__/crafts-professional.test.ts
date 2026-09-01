// craft_providers rows → the shared ProfessionalProfile shape.
//
// WHY THIS FILE IS THE ONLY PROOF THERE IS: craft_providers has zero rows on
// production, and so do craft_services, craft_works and craft_reviews. The
// provider profile route therefore cannot be rendered against real data by
// anybody — not by a browser, not by Playwright, not by me. A fixture is not
// the second-best verification here, it is the only honest one available, and
// pretending otherwise by seeding a fake tradesman into the live database
// would be worse than having no test at all.
//
// So the fixtures below are written against the SCHEMA rather than against a
// row someone imagined: every column craft_providers actually has, at the
// values its CHECK constraints actually allow, including the three that the
// resolver has to refuse to take at face value — `hours` defaulting to an
// empty object, `rating_avg` sitting at 0 with no reviews behind it, and
// `pricing_type = 'per_meter'`, which the shared PricingMode has no member for.

import { describe, expect, it } from "vitest";

import {
  toCraftProfessional,
  type CraftProviderRow,
} from "@/lib/data/crafts";
import { hasRating, profileBlocks, startingPrice } from "@/lib/professional";

/** Everything filled in — the profile a tradesman has after a year. */
const FULL: CraftProviderRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "أبو حسن الكهربجي",
  headline: "كهربائي منازل وتمديدات",
  bio: "بشتغل بالكهربا من ٢٠٠١.",
  photo_url: "https://example.test/photo.jpg",
  phone: " 71793516 ",
  whatsapp: "71793516",
  years_experience: 24,
  region: "north",
  status: "active",
  verified: true,
  hours: { mon: "08:00-17:00" },
  rating_avg: 4.5,
  rating_count: 2,
  completed_count: 31,
  lb_areas: { name_ar: "طرابلس", name_en: "Tripoli" },
  craft_provider_trades: [
    { trades: { slug: "electrician", name_ar: "كهربائي", name_en: "Electrician" } },
    { trades: null },
  ],
  craft_provider_areas: [
    { lb_areas: { slug: "tripoli", name_ar: "طرابلس", name_en: "Tripoli" } },
    { lb_areas: { slug: "koura", name_ar: "الكورة", name_en: "Koura" } },
  ],
  craft_services: [
    {
      id: "s2",
      name: "تمديد شقة",
      description: null,
      pricing_type: "quote",
      price: null,
      duration_minutes: null,
      sort_order: 2,
    },
    {
      id: "s1",
      name: "معاينة عطل",
      description: "زيارة وتشخيص",
      pricing_type: "from",
      price: 30,
      duration_minutes: 45,
      sort_order: 1,
    },
  ],
  craft_works: [
    { id: "w2", title: null, image_url: "https://example.test/b.jpg", sort_order: 2 },
    { id: "w1", title: "لوحة كهربا", image_url: "https://example.test/a.jpg", sort_order: 1 },
  ],
  craft_reviews: [
    {
      id: "r1",
      rating: 5,
      comment: "إجا بنفس اليوم.",
      customer_name: "رنا خ.",
      created_at: "2026-06-14T09:00:00Z",
    },
    {
      id: "r2",
      rating: 4,
      comment: null,
      customer_name: null,
      created_at: "2026-07-01T09:00:00Z",
    },
  ],
};

/** The row a tradesman has ten seconds after signing up — which is the only
 *  shape that will exist for a while, so it is the one that has to be right. */
const BARE: CraftProviderRow = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "حسين",
  headline: null,
  bio: null,
  photo_url: null,
  phone: null,
  whatsapp: "   ",
  years_experience: null,
  region: null,
  status: "active",
  verified: false,
  // The column is `jsonb NOT NULL default '{}'`, so this is what every new row
  // genuinely holds.
  hours: {},
  rating_avg: 0,
  rating_count: 0,
  completed_count: 0,
  lb_areas: null,
  craft_provider_trades: [],
  craft_provider_areas: [],
  craft_services: [],
  craft_works: [],
  craft_reviews: [],
};

describe("toCraftProfessional — a filled-in tradesman", () => {
  const { profile, contact, tradeSlugs } = toCraftProfessional(FULL, "ar");

  it("resolves as a craft profile, not a freelance one", () => {
    expect(profile.kind).toBe("craft");
  });

  it("names trades and covered areas in the requested locale", () => {
    expect(profile.specialties).toEqual(["كهربائي"]);
    expect(profile.area.areas).toEqual(["طرابلس", "الكورة"]);
    expect(toCraftProfessional(FULL, "en").profile.specialties).toEqual([
      "Electrician",
    ]);
    expect(tradeSlugs).toEqual(["electrician"]);
  });

  it("drops a null embed rather than crashing on it", () => {
    // PostgREST returns `{ trades: null }` for a join row whose target was
    // filtered out — an inactive trade, say.
    expect(profile.specialties).toHaveLength(1);
  });

  it("marks admin verification as an identity check, never as a paid tier", () => {
    expect(profile.trust.identityVerified).toBe(true);
    expect(profile.trust.pro).toBeUndefined();
  });

  it("sorts services and portfolio by sort_order, not by arrival order", () => {
    expect(profile.services.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(profile.portfolio.map((w) => w.id)).toEqual(["w1", "w2"]);
  });

  it("gives a quote-only service no amount at all", () => {
    const quoted = profile.services.find((s) => s.id === "s2");
    expect(quoted?.price.mode).toBe("quote_required");
    expect(quoted?.price.amount).toBeNull();
  });

  it("takes the starting price from the cheapest priced service", () => {
    expect(startingPrice(profile.services)).toBe(30);
  });

  it("never claims a self-uploaded photo was a Matjar job", () => {
    expect(profile.portfolio.every((w) => w.viaMatjar === false)).toBe(true);
  });

  it("shows reviews newest first and marks them as verified jobs", () => {
    // craft_reviews_write (0239) only admits a review attached to a request
    // the reviewer owns and the provider marked 'completed'. There is no other
    // way for one of these rows to exist.
    expect(profile.reviews.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(profile.reviews.every((r) => r.verifiedJob)).toBe(true);
  });

  it("keeps real opening hours", () => {
    expect(profile.hours).toEqual({ mon: "08:00-17:00" });
  });

  it("trims the contact numbers and never exposes an address", () => {
    expect(contact.phone).toBe("71793516");
    expect(contact.whatsapp).toBe("71793516");
    // §36: coverage is a different fact from residence, and the profile shape
    // has nowhere to put an address even if the schema had one.
    expect(Object.keys(profile.area).sort()).toEqual(["areas", "onSite", "region"]);
  });

  it("renders the craft block order: services and coverage before the CV", () => {
    expect(profileBlocks(profile)).toEqual([
      "about",
      "services",
      "portfolio",
      "area",
      "availability",
      "experience",
      "reviews",
    ]);
  });
});

describe("toCraftProfessional — a brand-new tradesman", () => {
  const { profile, contact } = toCraftProfessional(BARE, "ar");

  it("reads an empty hours object as no hours, not as availability", () => {
    // `hours != null` is what profileBlocks() tests, and the column's default
    // would otherwise make every new provider claim opening hours they never
    // set.
    expect(profile.hours).toBeUndefined();
    expect(profileBlocks(profile)).not.toContain("availability");
  });

  it("turns rating_avg 0 with no reviews into no rating at all", () => {
    expect(profile.ratingAvg).toBeNull();
    expect(hasRating(profile)).toBe(false);
  });

  it("reports zero completed jobs and zero years as absent, not as zero", () => {
    expect(profile.completedCount).toBeNull();
    expect(profile.yearsExperience).toBeNull();
  });

  it("renders no blocks whatsoever", () => {
    expect(profileBlocks(profile)).toEqual([]);
  });

  it("leaves an unverified provider with no trust facts to display", () => {
    expect(profile.trust).toEqual({});
  });

  it("treats a whitespace-only phone number as absent", () => {
    expect(contact.phone).toBeNull();
    expect(contact.whatsapp).toBeNull();
  });
});

describe("toCraftProfessional — per-metre pricing", () => {
  it("refuses to turn a rate per square metre into a starting price", () => {
    const row: CraftProviderRow = {
      ...BARE,
      craft_services: [
        {
          id: "s1",
          name: "تبليط",
          description: null,
          pricing_type: "per_meter",
          price: 12,
          duration_minutes: null,
          sort_order: 1,
        },
      ],
    };
    const { profile } = toCraftProfessional(row, "ar");
    // PricingMode has no per-unit member. 'from' would have put "يبدأ من $12"
    // on the card for a job that costs $12 A METRE, so the number is dropped
    // rather than misread.
    expect(profile.services[0].price.mode).toBe("quote_required");
    expect(profile.services[0].price.amount).toBeNull();
    expect(startingPrice(profile.services)).toBeNull();
  });
});

describe("toCraftProfessional — locale", () => {
  it("falls back to the base area name when the provider set no region", () => {
    const row: CraftProviderRow = {
      ...BARE,
      region: null,
      lb_areas: { name_ar: "بيروت", name_en: "Beirut" },
    };
    expect(toCraftProfessional(row, "ar").profile.area.region).toBe("بيروت");
    expect(toCraftProfessional(row, "en").profile.area.region).toBe("Beirut");
  });
});
