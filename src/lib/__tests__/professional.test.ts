import { describe, it, expect } from "vitest";
import {
  hasRating,
  startingPrice,
  profileBlocks,
  completeness,
  primaryCtaKey,
  type ProfessionalProfile,
  type ProfessionalService,
} from "@/lib/professional";

// Three route agents build on this resolver, so a wrong answer here is a wrong
// answer in both sectors at once.
//
// Every case below is drawn from the data that is actually on production
// (measured 2026-08-24), not from a hypothetical marketplace:
//
//   craft_providers   0 rows — not one craftsman exists
//   gigs              3 rows, all belonging to ONE person
//   that person       name only: no photo, bio, skills, languages
//   ratings anywhere  0
//
// The sparse profile is therefore the SHIPPING case, not an edge case, and
// most of these tests are about what must NOT appear.

/** The one real freelancer: a name, three services, and nothing else. */
function realFreelancer(
  over: Partial<ProfessionalProfile> = {},
): ProfessionalProfile {
  return {
    kind: "freelance",
    id: "8b6f9cdc-3100-4f4b-a2df-3cb3e7c1e80a",
    name: "باشن",
    headline: null,
    bio: null,
    photoUrl: null,
    specialties: [],
    skills: [],
    languages: [],
    yearsExperience: null,
    trust: {},
    area: { areas: [] },
    services: [
      { id: "g1", name: "تصميم بوستات احترافية", price: { mode: "from", amount: 5 }, deliveryDays: 2 },
      { id: "g2", name: "تصوير احترافي", price: { mode: "from", amount: 30 }, deliveryDays: 2 },
      { id: "g3", name: "ممثل او موديل", price: { mode: "from", amount: 30 }, deliveryDays: 1 },
    ],
    portfolio: [],
    reviews: [],
    ratingAvg: null,
    ratingCount: 0,
    completedCount: 0,
    hours: null,
    ...over,
  };
}

describe("hasRating — a star needs a review behind it", () => {
  it("is false with no reviews, which is every professional on the platform", () => {
    expect(hasRating({ ratingAvg: null, ratingCount: 0 })).toBe(false);
  });

  it("is false when a count exists but the average is null or zero", () => {
    // A denormalised column can be half-written; showing "0.0 ★" is worse than
    // showing nothing at all.
    expect(hasRating({ ratingAvg: null, ratingCount: 4 })).toBe(false);
    expect(hasRating({ ratingAvg: 0, ratingCount: 4 })).toBe(false);
  });

  it("is false for an average with no reviews under it", () => {
    expect(hasRating({ ratingAvg: 5, ratingCount: 0 })).toBe(false);
  });

  it("is true only when both are real", () => {
    expect(hasRating({ ratingAvg: 4.9, ratingCount: 38 })).toBe(true);
  });
});

describe("startingPrice — null is an answer, zero is a lie", () => {
  it("returns null when every service must be quoted", () => {
    // An electrician has to see the fault. "يبدأ من $0" would be a number the
    // platform invented and the tradesman never gave.
    const quoted: ProfessionalService[] = [
      { id: "a", name: "كشف عطل", price: { mode: "quote_required" } },
      { id: "b", name: "تمديدات", price: { mode: "quote_required" } },
    ];
    expect(startingPrice(quoted)).toBeNull();
  });

  it("ignores quoted services when priced ones exist", () => {
    const mixed: ProfessionalService[] = [
      { id: "a", name: "كشف", price: { mode: "quote_required" } },
      { id: "b", name: "زيارة", price: { mode: "visit_fee", amount: 15 } },
      { id: "c", name: "تركيب", price: { mode: "from", amount: 40 } },
    ];
    expect(startingPrice(mixed)).toBe(15);
  });

  it("returns null for no services at all", () => {
    expect(startingPrice([])).toBeNull();
  });

  it("never treats a zero or negative amount as a price", () => {
    // A row with amount 0 is unset data, not free work.
    const zeroed: ProfessionalService[] = [
      { id: "a", name: "x", price: { mode: "fixed", amount: 0 } },
      { id: "b", name: "y", price: { mode: "from", amount: null } },
    ];
    expect(startingPrice(zeroed)).toBeNull();
  });

  it("finds the floor across the real freelancer's three gigs", () => {
    expect(startingPrice(realFreelancer().services)).toBe(5);
  });
});

describe("profileBlocks — a block never appears empty", () => {
  it("gives the real freelancer exactly one block: their services", () => {
    // This is the shipping state. Name + 3 services and nothing else, so six of
    // the seven possible blocks must stay off the page.
    expect(profileBlocks(realFreelancer())).toEqual(["services"]);
  });

  it("gives a profile with nothing at all no blocks, rather than seven empty ones", () => {
    const bare = realFreelancer({ services: [] });
    expect(profileBlocks(bare)).toEqual([]);
  });

  it("leads freelance with the portfolio — for a designer it is the credential", () => {
    const p = realFreelancer({
      bio: "مصمم جرافيك",
      portfolio: [{ id: "w1", imageUrl: "/a.jpg" }],
      skills: ["Figma"],
    });
    const blocks = profileBlocks(p);
    expect(blocks.indexOf("portfolio")).toBeLessThan(blocks.indexOf("services"));
  });

  it("leads a trade with services and area — the questions are trust and cost", () => {
    const craft: ProfessionalProfile = {
      ...realFreelancer(),
      kind: "craft",
      bio: "كهربائي",
      area: { region: "north", areas: ["طرابلس"], onSite: true },
      portfolio: [{ id: "w1", imageUrl: "/a.jpg" }],
    };
    const blocks = profileBlocks(craft);
    expect(blocks.indexOf("services")).toBeLessThan(blocks.indexOf("portfolio"));
    expect(blocks).toContain("area");
  });

  it("counts a whitespace-only bio as no bio", () => {
    expect(profileBlocks(realFreelancer({ bio: "   " }))).not.toContain("about");
  });

  it("shows experience only for a real number of years", () => {
    expect(profileBlocks(realFreelancer({ yearsExperience: 0 }))).not.toContain("experience");
    expect(profileBlocks(realFreelancer({ yearsExperience: 6 }))).toContain("experience");
  });

  it("treats remote-only as a real service area", () => {
    // A freelancer with no city still works somewhere: remotely.
    const remote = realFreelancer({ area: { areas: [], remote: true } });
    expect(profileBlocks(remote)).toContain("area");
  });

  it("never returns a block twice", () => {
    const full = realFreelancer({
      bio: "x", skills: ["a"], yearsExperience: 3,
      portfolio: [{ id: "w", imageUrl: "/a.jpg" }],
      reviews: [{ id: "r", rating: 5, createdAt: "2026-01-01" }],
      area: { areas: ["طرابلس"] }, hours: {},
    });
    const blocks = profileBlocks(full);
    expect(new Set(blocks).size).toBe(blocks.length);
  });
});

describe("completeness — coaching, and honest about it", () => {
  it("tells the real freelancer what is missing without flattering them", () => {
    const c = completeness(realFreelancer());
    // Services are the one thing they have done.
    expect(c.steps.find((s) => s.key === "services")?.done).toBe(true);
    for (const key of ["photo", "headline", "bio", "skills", "portfolio"]) {
      expect(c.steps.find((s) => s.key === key)?.done, `${key} must be undone`).toBe(false);
    }
    expect(c.done).toBe(1);
  });

  it("asks a trade for its trades, area and hours — not for skills", () => {
    const craft = { ...realFreelancer(), kind: "craft" as const };
    const keys = completeness(craft).steps.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["trades", "area", "hours"]));
    expect(keys).not.toContain("skills");
  });

  it("asks a freelancer for skills and languages — not for a service area grid", () => {
    const keys = completeness(realFreelancer()).steps.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["skills", "languages"]));
    expect(keys).not.toContain("trades");
  });

  it("does not call a single portfolio image a portfolio", () => {
    const one = realFreelancer({ portfolio: [{ id: "w", imageUrl: "/a.jpg" }] });
    expect(completeness(one).steps.find((s) => s.key === "portfolio")?.done).toBe(false);
    const three = realFreelancer({
      portfolio: [1, 2, 3].map((n) => ({ id: `w${n}`, imageUrl: `/${n}.jpg` })),
    });
    expect(completeness(three).steps.find((s) => s.key === "portfolio")?.done).toBe(true);
  });

  it("puts the heaviest steps first, so the coaching leads with what customers decide on", () => {
    const w = completeness(realFreelancer()).steps.map((s) => s.weight);
    expect(w).toEqual([...w].sort((a, b) => b - a));
  });
});

describe("primaryCtaKey — a trade is asked to come, a freelancer to quote", () => {
  it("does not call both of them an order", () => {
    expect(primaryCtaKey("craft")).toBe("requestService");
    expect(primaryCtaKey("freelance")).toBe("requestQuote");
    expect(primaryCtaKey("craft")).not.toBe(primaryCtaKey("freelance"));
  });
});
