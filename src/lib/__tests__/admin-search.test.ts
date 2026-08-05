import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  filterSections,
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
