import { describe, it, expect } from "vitest";
import {
  applyFilters,
  bound,
  emptyFilters,
  filtersActive,
  type CatalogueFilterState,
  type FilterableProduct,
} from "@/lib/catalogue-filters";

type Row = FilterableProduct & { id: string };

const car = (
  id: string,
  price: number,
  attributes: Record<string, string> = {},
  brand: string | null = null,
): Row => ({ id, price, brand, attributes });

const withPrice = (s: CatalogueFilterState, min: string, max: string) => ({
  ...s,
  price: { min, max },
});
const withRange = (
  s: CatalogueFilterState,
  key: string,
  min: string,
  max: string,
) => ({ ...s, ranges: { ...s.ranges, [key]: { min, max } } });

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("a fresh filter state narrows nothing", () => {
  it("returns the catalogue untouched", () => {
    const rows = [car("a", 5), car("b", 50), car("c", 500)];
    expect(ids(applyFilters(rows, emptyFilters()))).toEqual(["a", "b", "c"]);
    expect(filtersActive(emptyFilters())).toBe(false);
  });

  it("carries a brand arriving from a ?brand= link", () => {
    const s = emptyFilters("Kia");
    expect(filtersActive(s)).toBe(true);
    const rows = [car("a", 5, {}, "Kia"), car("b", 5, {}, "Honda")];
    expect(ids(applyFilters(rows, s))).toEqual(["a"]);
  });
});

describe("a half-typed number is not a filter", () => {
  // The failure this prevents: a shopper types "1" on the way to "150", and
  // between the two keystrokes the grid empties. Anything unparseable is
  // treated as no bound at all.
  it("ignores an empty, blank or unparseable end", () => {
    expect(bound("")).toBeNull();
    expect(bound("   ")).toBeNull();
    expect(bound("abc")).toBeNull();
    expect(bound("-")).toBeNull();
    expect(bound("12.5")).toBe(12.5);
  });

  it("does not count an unparseable end as active", () => {
    expect(filtersActive(withPrice(emptyFilters(), "", ""))).toBe(false);
    expect(filtersActive(withPrice(emptyFilters(), "abc", ""))).toBe(false);
    expect(filtersActive(withPrice(emptyFilters(), "0", ""))).toBe(true);
  });

  it("keeps the whole list while only one end is typed", () => {
    const rows = [car("a", 5), car("b", 50)];
    expect(ids(applyFilters(rows, withPrice(emptyFilters(), "", "")))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(applyFilters(rows, withPrice(emptyFilters(), "10", "")))).toEqual(
      ["b"],
    );
  });
});

describe("the price range reads the price the customer would actually pay", () => {
  // The trap: filtering on `price` rather than `effectivePrice` makes a
  // discounted item disappear from a range that contains the number printed on
  // its own card. A shopper filtering $0–$10 would not see the $8 sale item
  // because its list price is $30.
  const sale: Row = {
    id: "sale",
    price: 30,
    discountPrice: 8,
    attributes: {},
  };
  const plain = car("plain", 9);

  it("keeps a discounted item inside the range its sticker price falls in", () => {
    const s = withPrice(emptyFilters(), "0", "10");
    expect(ids(applyFilters([sale, plain], s))).toEqual(["sale", "plain"]);
  });

  it("excludes it from the range its list price falls in", () => {
    const s = withPrice(emptyFilters(), "20", "40");
    expect(ids(applyFilters([sale, plain], s))).toEqual([]);
  });

  it("includes both ends", () => {
    const rows = [car("a", 10), car("b", 20), car("c", 30)];
    expect(ids(applyFilters(rows, withPrice(emptyFilters(), "10", "30")))).toEqual(
      ["a", "b", "c"],
    );
    expect(ids(applyFilters(rows, withPrice(emptyFilters(), "11", "29")))).toEqual(
      ["b"],
    );
  });
});

describe("an attribute range", () => {
  const fleet = [
    car("old", 4000, { mileage: "220000", year: "2008" }),
    car("mid", 9000, { mileage: "95000", year: "2015" }),
    car("new", 22000, { mileage: "12000", year: "2022" }),
    car("unknown", 7000, { year: "2016" }), // no mileage recorded
  ];

  it("cuts by a single upper bound", () => {
    const s = withRange(emptyFilters(), "mileage", "", "100000");
    expect(ids(applyFilters(fleet, s))).toEqual(["mid", "new"]);
  });

  it("drops a row that does not carry the value at all", () => {
    // A car with no mileage recorded is not "under 100,000 km" — the same rule
    // the exact-match dropdown already follows for a blank.
    const s = withRange(emptyFilters(), "mileage", "0", "999999");
    expect(ids(applyFilters(fleet, s))).not.toContain("unknown");
  });

  it("leaves it in when no bound on that field is set", () => {
    const s = withRange(emptyFilters(), "year", "2015", "");
    expect(ids(applyFilters(fleet, s))).toEqual(["mid", "new", "unknown"]);
  });

  it("combines with a dropdown, a brand and a price at once", () => {
    const mixed: Row[] = [
      car("hit", 9000, { mileage: "50000", gearbox: "automatic" }, "Kia"),
      car("wrongBrand", 9000, { mileage: "50000", gearbox: "automatic" }, "BMW"),
      car("wrongBox", 9000, { mileage: "50000", gearbox: "manual" }, "Kia"),
      car("tooFar", 9000, { mileage: "300000", gearbox: "automatic" }, "Kia"),
      car("tooDear", 90000, { mileage: "50000", gearbox: "automatic" }, "Kia"),
    ];
    const s: CatalogueFilterState = {
      brand: "Kia",
      attrs: { gearbox: "automatic" },
      ranges: { mileage: { min: "", max: "100000" } },
      price: { min: "", max: "20000" },
    };
    expect(ids(applyFilters(mixed, s))).toEqual(["hit"]);
  });
});

describe("clearing", () => {
  it("reports every kind of filter as active", () => {
    expect(filtersActive({ ...emptyFilters(), brand: "Kia" })).toBe(true);
    expect(filtersActive({ ...emptyFilters(), attrs: { fuel: "diesel" } })).toBe(
      true,
    );
    expect(filtersActive(withRange(emptyFilters(), "year", "2015", ""))).toBe(
      true,
    );
    expect(filtersActive(withPrice(emptyFilters(), "", "50"))).toBe(true);
  });

  it("treats a dropdown reset to its blank option as inactive", () => {
    expect(filtersActive({ ...emptyFilters(), attrs: { fuel: "" } })).toBe(false);
  });
});
