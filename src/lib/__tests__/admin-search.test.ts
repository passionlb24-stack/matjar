import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  filterSections,
  filterByQuery,
  matchesQuery,
  type SearchableSection,
} from "@/lib/admin-search";

const S: SearchableSection[] = [
  { key: "stores", label: "المتاجر", group: "السوق", href: "/ar/admin/stores" },
  { key: "orders", label: "الطلبات", group: "السوق", href: "/ar/admin/orders" },
  { key: "market", label: "سوق الأحد", group: "السوق", href: "/ar/admin/market" },
  { key: "freelance", label: "الفريلانس", group: "المحتوى", href: "/ar/admin/freelance" },
  { key: "subscriptions", label: "الاشتراكات", group: "الأعمال", href: "/ar/admin/subscriptions" },
  { key: "settings", label: "الإعدادات", group: "النظام", href: "/ar/admin/settings" },
];

describe("normalizeLabel", () => {
  it("folds the hamza spellings people actually type", () => {
    expect(normalizeLabel("الإعدادات")).toBe(normalizeLabel("الاعدادات"));
    expect(normalizeLabel("سوق الأحد")).toBe(normalizeLabel("سوق الاحد"));
  });

  it("ignores harakat and tatweel", () => {
    expect(normalizeLabel("المتـــاجر")).toBe(normalizeLabel("المتاجر"));
    expect(normalizeLabel("الطَلبات")).toBe(normalizeLabel("الطلبات"));
  });

  it("collapses whitespace and is case-insensitive", () => {
    expect(normalizeLabel("  سوق   الاحد ")).toBe("سوق الاحد");
    expect(normalizeLabel("Orders")).toBe("orders");
  });
});

describe("filterSections", () => {
  it("shows the whole map when nothing is typed", () => {
    expect(filterSections(S, "")).toHaveLength(S.length);
    expect(filterSections(S, "   ")).toHaveLength(S.length);
  });

  it("matches a label", () => {
    expect(filterSections(S, "طلب").map((s) => s.key)).toEqual(["orders"]);
  });

  // The point of the normalisation: nobody should have to remember the hamza.
  it("matches regardless of how the hamza was typed", () => {
    expect(filterSections(S, "الاعدادات").map((s) => s.key)).toEqual(["settings"]);
    expect(filterSections(S, "سوق الاحد").map((s) => s.key)).toEqual(["market"]);
  });

  it("matches the group name, so a group finds its members", () => {
    expect(filterSections(S, "السوق").map((s) => s.key)).toEqual([
      "stores",
      "orders",
      "market",
    ]);
  });

  it("matches the english key, for anyone who thinks in the URL", () => {
    expect(filterSections(S, "freelance").map((s) => s.key)).toEqual(["freelance"]);
  });

  // Every word must land: more typing narrows, which is the only behaviour that
  // makes a second word worth typing.
  it("narrows on a second word rather than widening", () => {
    expect(filterSections(S, "سوق").length).toBeGreaterThan(1);
    expect(filterSections(S, "سوق احد").map((s) => s.key)).toEqual(["market"]);
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(filterSections(S, "زززز")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The record-level matcher (ISS-014). Same rules as the palette, pointed at
// rows: the point of sharing normalizeLabel is that an admin does not have to
// learn two different searches inside one panel.

type Row = { name: string; owner: string | null; note?: string | null };

const R: Row[] = [
  { name: "مطعم الأمير", owner: "أحمد خليل", note: "بيروت" },
  { name: "صيدلية النور", owner: null, note: null },
  { name: "Beirut Bakery", owner: "Sami", note: "Hamra" },
];

describe("matchesQuery", () => {
  it("matches everything when nothing is typed", () => {
    expect(matchesQuery("", ["anything"])).toBe(true);
    expect(matchesQuery("   ", [null])).toBe(true);
  });

  // The reason this exists rather than `.toLowerCase().includes()`, which is
  // what the store and moderation filters used and which fails this case.
  it("folds the hamza across fields", () => {
    expect(matchesQuery("احمد", ["أحمد خليل"])).toBe(true);
    expect(matchesQuery("الامير", ["مطعم الأمير"])).toBe(true);
  });

  it("skips nullish fields instead of matching on them", () => {
    expect(matchesQuery("نور", ["صيدلية النور", null, undefined])).toBe(true);
    expect(matchesQuery("نور", [null, undefined])).toBe(false);
  });

  it("requires every word, so a second word narrows", () => {
    expect(matchesQuery("مطعم بيروت", ["مطعم الأمير", "بيروت"])).toBe(true);
    expect(matchesQuery("مطعم صيدا", ["مطعم الأمير", "بيروت"])).toBe(false);
  });

  it("matches across field boundaries, not only within one field", () => {
    // "الأمير أحمد" spans the name and the owner. A per-field match would miss
    // this, and it is exactly how someone describes a shop out loud.
    expect(matchesQuery("الامير احمد", ["مطعم الأمير", "أحمد خليل"])).toBe(true);
  });

  it("is case-insensitive for latin text", () => {
    expect(matchesQuery("BAKERY", ["Beirut Bakery"])).toBe(true);
  });
});

describe("filterByQuery", () => {
  const fields = (r: Row) => [r.name, r.owner, r.note];

  it("returns the input untouched when the query is empty", () => {
    expect(filterByQuery(R, "", fields)).toHaveLength(R.length);
    expect(filterByQuery(R, "  ", fields)).toHaveLength(R.length);
  });

  it("filters on any of the named fields", () => {
    expect(filterByQuery(R, "احمد", fields).map((r) => r.name)).toEqual([
      "مطعم الأمير",
    ]);
    expect(filterByQuery(R, "hamra", fields).map((r) => r.name)).toEqual([
      "Beirut Bakery",
    ]);
  });

  it("returns an empty list rather than a fallback guess", () => {
    expect(filterByQuery(R, "زززز", fields)).toEqual([]);
  });

  it("preserves the incoming order, which is the page's sort", () => {
    // The queues hand rows in a deliberate order — worst-rated first, newest
    // first. Filtering must not become a re-sort.
    const hit = filterByQuery(R, "ا", fields);
    expect(hit.map((r) => r.name)).toEqual(
      R.filter((r) => hit.includes(r)).map((r) => r.name),
    );
  });
});
