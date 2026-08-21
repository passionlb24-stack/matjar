import { describe, expect, it } from "vitest";
import {
  CATALOGUE_TARGET,
  compareStalls,
  stallMessage,
  type StallStage,
} from "@/lib/data/merchant-stalls";

// The stalled-merchant report's two pure pieces: the sentence each stage sends
// to a real shopkeeper, and the order the owner works the list in.
//
// The sentence is the part worth pinning down. It is the only string in this
// codebase that leaves the platform addressed to a named person, and the ways
// it can be wrong are all silent: an unreplaced {placeholder}, a share-your-link
// nudge sent to a shop with nothing to sell, "nobody has ordered" sent to a
// merchant looking at an order. None of those throw, and none of them would be
// noticed until a merchant replied.

const base = {
  name: "ملحمة البركة",
  category: "retail" as const,
  offerings: 1,
  target: CATALOGUE_TARGET,
  days: 30,
  storeUrl: "https://matjarlb.com/ar/albarake",
  needsPin: false,
};

const STAGES: StallStage[] = ["empty", "thin", "quiet"];

describe("the catalogue target comes from the merchant's own checklist", () => {
  it("is the size completeness.ts calls done, not a number typed twice", () => {
    // completeness.ts: "Three is the point where a page stops looking
    // abandoned." If that rule moves, this moves with it — and if it ever
    // stopped being a threshold, the derivation would fail loudly here rather
    // than quietly telling merchants to add an item they already added.
    expect(CATALOGUE_TARGET).toBe(3);
  });
});

describe("the message a merchant actually receives", () => {
  it.each(STAGES)("%s: names the shop and fills every placeholder", (stage) => {
    const msg = stallMessage({ ...base, stage, offerings: stage === "empty" ? 0 : 2 });
    expect(msg).toContain(base.name);
    expect(msg).not.toMatch(/\{[a-z]+\}/);
    expect(msg.trim()).toBe(msg);
  });

  it("never tells a shop with nothing to sell to share its link", () => {
    // The whole reason this is a stage and not a score. A merchant with an
    // empty page who is sent to promote it has been asked to advertise nothing.
    const msg = stallMessage({ ...base, stage: "empty", offerings: 0 });
    expect(msg).not.toContain(base.storeUrl);
  });

  it("asks an untouched shop for exactly one thing, pin or no pin", () => {
    // isFirstRun's rule in store-onboarding.ts: a person handed two tasks when
    // they have done none does neither.
    const withPin = stallMessage({
      ...base,
      stage: "empty",
      offerings: 0,
      needsPin: true,
    });
    const withoutPin = stallMessage({ ...base, stage: "empty", offerings: 0 });
    expect(withPin).toBe(withoutPin);
  });

  it("adds the map-pin ask only to shops that already did the main thing", () => {
    for (const stage of ["thin", "quiet"] as const) {
      const on = stallMessage({ ...base, stage, offerings: 2, needsPin: true });
      const off = stallMessage({ ...base, stage, offerings: 2, needsPin: false });
      expect(on.length).toBeGreaterThan(off.length);
      expect(on).toContain("عالخريطة");
      expect(off).not.toContain("عالخريطة");
    }
  });

  it("gives the shop its own link when it is asking for a share", () => {
    const msg = stallMessage({ ...base, stage: "quiet", offerings: 4 });
    expect(msg).toContain(base.storeUrl);
  });

  it("speaks the sector's own noun, not 'products' for everyone", () => {
    const say = (category: "retail" | "food" | "healthcare") =>
      stallMessage({ ...base, category, stage: "thin", offerings: 2 });
    // A clinic offers خدمات and a restaurant أصناف. Same row shape, same code
    // path — the noun is read off the same key the merchant's own "add" button
    // is labelled from (modules.ts itemsKey).
    expect(say("healthcare")).toContain("خدمت");
    expect(say("food")).toContain("صنف");
    expect(say("retail")).toContain("غرض");
    expect(say("food")).not.toContain("غرض");
  });

  it("counts in Arabic rather than pasting a digit in front of a singular", () => {
    const at = (offerings: number) =>
      stallMessage({ ...base, stage: "thin", offerings });
    expect(at(1)).toContain("غرض واحد");
    expect(at(2)).toContain("غرضين");
    expect(at(1)).not.toContain("1 غرض");
  });

  it("counts days the same way", () => {
    const at = (days: number) =>
      stallMessage({ ...base, stage: "thin", offerings: 2, days });
    expect(at(1)).toContain("صارلو يوم");
    expect(at(2)).toContain("يومين");
    expect(at(8)).toContain("8 أيّام");
    expect(at(51)).toContain("51 يوم");
  });
});

describe("the order the owner works the list in", () => {
  const row = (stage: StallStage, days: number, name = "x") => ({
    stage,
    days,
    name,
  });

  it("puts a half-finished shop above one that never started", () => {
    // The brief's own comparison: a shop one item away from being real is a
    // better use of an afternoon than one that has never logged in — even when
    // the second has been stuck far longer.
    expect(compareStalls(row("thin", 3), row("empty", 300))).toBeLessThan(0);
  });

  it("puts a finished-but-unvisited shop above one with nothing on it", () => {
    expect(compareStalls(row("quiet", 20), row("empty", 300))).toBeLessThan(0);
  });

  it("puts the longest-stuck first inside one stage", () => {
    expect(compareStalls(row("thin", 51), row("thin", 7))).toBeLessThan(0);
  });

  it("is a total order — equal rows fall back to the name", () => {
    expect(compareStalls(row("thin", 7, "أ"), row("thin", 7, "ب"))).toBeLessThan(
      0,
    );
    expect(compareStalls(row("thin", 7, "أ"), row("thin", 7, "أ"))).toBe(0);
  });

  it("sorts a whole list the way the page renders it", () => {
    const rows = [
      row("empty", 35, "Mehras Chtoura"),
      row("quiet", 34, "دكتور عمر الصمد"),
      row("thin", 7, "Passion Glow"),
      row("quiet", 35, "Let’s meat"),
      row("thin", 51, "Nazih Home"),
      row("thin", 35, "Giggles Care Lebanon"),
    ];
    expect([...rows].sort(compareStalls).map((r) => r.name)).toEqual([
      "Nazih Home",
      "Giggles Care Lebanon",
      "Passion Glow",
      "Let’s meat",
      "دكتور عمر الصمد",
      "Mehras Chtoura",
    ]);
  });
});
