import { describe, it, expect } from "vitest";
import {
  attributeSummary,
  categoryAttributes,
  attrEntryFields,
  attrLegacyFields,
  attrFacetOptions,
  attrRangeBounds,
  attributeFilterFields,
  attrCoverage,
  MIN_ATTR_FACET_OPTIONS,
  type AttrRow,
} from "@/lib/attributes";

describe("attributeSummary", () => {
  it("builds a dotted summary in Arabic for real estate, in field order with units", () => {
    const s = attributeSummary(
      "realEstate",
      { rooms: "3", area: "140", bathrooms: "2" },
      "ar",
    );
    expect(s).toBe("3 غرف · 2 حمّام · 140 م²");
  });

  it("translates select values and skips missing fields", () => {
    // `brand` is deliberately absent from the summary now: it is a real column
    // on products and the product page already renders it as its own clickable
    // brand link, so repeating it out of jsonb printed the make twice — and
    // filed a dealer's typed value where the brand filter never looked.
    const s = attributeSummary(
      "automotive",
      { brand: "Kia", year: "2018", fuel: "diesel" },
      "en",
    );
    expect(s).toBe("2018 · Diesel");
  });

  it("returns empty for a category with no attribute schema", () => {
    expect(attributeSummary("food", { anything: "x" }, "ar")).toBe("");
  });

  it("returns empty when attributes are null/undefined", () => {
    expect(attributeSummary("automotive", null, "en")).toBe("");
    expect(attributeSummary("automotive", undefined, "ar")).toBe("");
  });

  it("returns empty when no known field has a value", () => {
    expect(attributeSummary("automotive", { unknown: "x" }, "en")).toBe("");
  });

  it("describes a retail product, which it previously could not do at all", () => {
    // MJ-014, stated as the line a shopper actually sees under the product
    // name. Before this, `retail` had no schema, so attributeSummary returned
    // "" for every one of the forty-one products in production.
    const s = attributeSummary(
      "retail",
      { condition: "new", origin: "تركيا", dimensions: "120×60", warranty: "12" },
      "ar",
    );
    expect(s).toBe("جديد · تركيا · 120×60 · 12 شهر");
  });

  it("describes a menu row and a salon service", () => {
    expect(
      attributeSummary("food", { spicy: "hot", serves: "2" }, "ar"),
    ).toBe("حار كتير · 2 شخص");
    expect(
      attributeSummary("beauty", { audience: "women", venue: "home" }, "ar"),
    ).toBe("للنساء · عالبيت");
  });

  it("still renders a retired field's stored value", () => {
    // Six clinic services in production carry `duration` in jsonb. The field is
    // retired from ENTRY, not from display — retiring it from display would
    // blank those six storefronts.
    expect(attributeSummary("healthcare", { duration: "30" }, "ar")).toBe(
      "30 دقيقة",
    );
  });
});

// ===========================================================================
// The registry's structural guarantees
// ===========================================================================

describe("the attribute registry describes things products cannot already say", () => {
  // Real columns on `products`. An attribute sharing one of these names is not
  // a richer description, it is a second answer to a question already answered
  // — and the platform has already been bitten by exactly that: `duration`
  // shadowed `duration_minutes`, the create form showed a clinic two duration
  // inputs, and six of seven live services filled the one the booking engine
  // does not read. Nothing may join them.
  const PRODUCT_COLUMNS = [
    "name",
    "description",
    "price",
    "discount_price",
    "brand",
    "sku",
    "stock",
    "cost",
    "section_id",
    "item_kind",
    "duration_minutes",
    "buffer_minutes",
    "capacity_per_slot",
  ];

  it("never shadows a real products column", () => {
    for (const [category, fields] of Object.entries(categoryAttributes)) {
      for (const f of fields ?? []) {
        // `duration` is the known offender and is quarantined as `legacy`; it
        // is allowed to remain only because it is no longer offered for entry.
        if (f.legacy) continue;
        const snake = f.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        expect(
          PRODUCT_COLUMNS,
          `${category}.${f.key} duplicates a real products column`,
        ).not.toContain(snake);
        expect(PRODUCT_COLUMNS).not.toContain(f.key);
      }
    }
  });

  it("gives every field a usable label in both locales", () => {
    for (const [category, fields] of Object.entries(categoryAttributes)) {
      for (const f of fields ?? []) {
        expect(f.ar.trim(), `${category}.${f.key} has no Arabic label`).not.toBe(
          "",
        );
        expect(f.en.trim(), `${category}.${f.key} has no English label`).not.toBe(
          "",
        );
        // A shopkeeper reads these. An untranslated key leaking through as a
        // label is the failure mode, so the Arabic must not just be the key.
        expect(f.ar, `${category}.${f.key} shows its key as a label`).not.toBe(
          f.key,
        );
      }
    }
  });

  it("gives every dropdown at least two labelled options", () => {
    // A select with one option is a label; with none it is an empty control.
    for (const [category, fields] of Object.entries(categoryAttributes)) {
      for (const f of fields ?? []) {
        if (f.type !== "select") continue;
        expect(
          f.options?.length ?? 0,
          `${category}.${f.key} is a dropdown with no real choice`,
        ).toBeGreaterThanOrEqual(2);
        for (const o of f.options ?? []) {
          expect(o.ar.trim(), `${category}.${f.key}.${o.value} ar`).not.toBe("");
          expect(o.en.trim(), `${category}.${f.key}.${o.value} en`).not.toBe("");
        }
      }
    }
  });

  it("uses each key once per sector", () => {
    for (const [category, fields] of Object.entries(categoryAttributes)) {
      const keys = (fields ?? []).map((f) => f.key);
      expect(new Set(keys).size, `${category} repeats an attribute key`).toBe(
        keys.length,
      );
    }
  });

  it("only marks a number field as a range", () => {
    // "Under $50" is a number question. A gearbox is not.
    for (const [category, fields] of Object.entries(categoryAttributes)) {
      for (const f of fields ?? []) {
        if (!f.range) continue;
        expect(f.type, `${category}.${f.key} is a non-numeric range`).toBe(
          "number",
        );
      }
    }
  });

  it("does not hand a range field to the dropdown renderer", () => {
    // The only attribute-filter control that exists today (store-products.tsx)
    // turns every `filter: true` field into a <select> of the distinct values
    // present. For a mileage or an area that is one option per listing — a
    // dropdown of four hundred numbers. Until a real two-ended control exists,
    // a field cannot be both a range and a rendered filter.
    for (const [category, fields] of Object.entries(categoryAttributes)) {
      for (const f of fields ?? []) {
        if (!f.range) continue;
        expect(
          f.filter ?? false,
          `${category}.${f.key} would render as a dropdown of every distinct value`,
        ).toBe(false);
      }
    }
  });

  it("gives the sectors that actually have catalogues something to say", () => {
    // MJ-014. These five have real stores AND real catalogue rows in
    // production; retail alone is eleven stores and forty-one products, and it
    // defined nothing at all. automotive and realEstate are deliberately absent
    // from this list — they have a vocabulary already and no rows to use it.
    for (const sector of ["retail", "food", "beauty", "services", "healthcare"] as const) {
      expect(
        attrEntryFields(sector).length,
        `${sector} cannot describe what it sells`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("a retired field is read but never offered again", () => {
  it("keeps duration out of the entry set for both sectors that had it", () => {
    for (const sector of ["healthcare", "services"] as const) {
      expect(attrEntryFields(sector).map((f) => f.key)).not.toContain("duration");
      expect(attrLegacyFields(sector).map((f) => f.key)).toContain("duration");
    }
  });

  it("still lists it among the fields the storefront reads", () => {
    expect((categoryAttributes.healthcare ?? []).map((f) => f.key)).toContain(
      "duration",
    );
  });

  it("never offers a retired field as a filter", () => {
    // Filtering on a field nobody may fill any more can only ever shrink.
    const rows: AttrRow[] = [
      { attributes: { duration: "20" } },
      { attributes: { duration: "30" } },
    ];
    expect(attributeFilterFields("healthcare", rows)).toEqual([]);
  });
});

// ===========================================================================
// MJ-013 — a filter is only offered when the data can back it
// ===========================================================================
//
// The same rule discovery.ts applies to store filters, applied to a catalogue.
// The defect this replaces: a `select` field offered its DECLARED options
// regardless of the rows, so a "Condition: new / used" dropdown rendered over
// forty-one products recording no condition, and either setting emptied the
// grid.

describe("attribute filters are offered from the rows, not from the schema", () => {
  const purpose = (categoryAttributes.realEstate ?? []).find(
    (f) => f.key === "purpose",
  )!;

  it("counts only rows that actually record a value", () => {
    const rows: AttrRow[] = [
      { attributes: { purpose: "sale" } },
      { attributes: { purpose: "  " } }, // whitespace is not a value
      { attributes: {} },
      { attributes: null },
      {},
    ];
    expect(attrCoverage(purpose, rows)).toBe(1);
  });

  it("offers no options at all when no row carries the field", () => {
    // The exact case that broke: the schema declares sale/rent, the catalogue
    // knows neither.
    const rows: AttrRow[] = [{ attributes: {} }, { attributes: {} }];
    expect(attrFacetOptions(purpose, rows)).toEqual([]);
  });

  it("drops an option no row is behind", () => {
    const rows: AttrRow[] = [
      { attributes: { purpose: "sale" } },
      { attributes: { purpose: "sale" } },
    ];
    expect(attrFacetOptions(purpose, rows).map((o) => o.value)).toEqual(["sale"]);
  });

  it("withholds the control when only one choice survives", () => {
    // One surviving option is a label, not a choice — MIN_ATTR_FACET_OPTIONS,
    // the same floor discovery.ts sets for a store facet.
    expect(MIN_ATTR_FACET_OPTIONS).toBe(2);
    const allForSale: AttrRow[] = [
      { attributes: { purpose: "sale" } },
      { attributes: { purpose: "sale" } },
    ];
    expect(attributeFilterFields("realEstate", allForSale).map((f) => f.key)).not.toContain(
      "purpose",
    );
  });

  it("offers the control once the rows genuinely differ", () => {
    const mixed: AttrRow[] = [
      { attributes: { purpose: "sale" } },
      { attributes: { purpose: "rent" } },
    ];
    expect(attributeFilterFields("realEstate", mixed).map((f) => f.key)).toContain(
      "purpose",
    );
  });

  it("offers nothing whatsoever for an empty catalogue", () => {
    // realEstate and automotive have exactly this in production today: a full
    // filter vocabulary and not one row. Every control must stay hidden.
    for (const sector of ["realEstate", "automotive"] as const) {
      expect(attributeFilterFields(sector, [])).toEqual([]);
    }
  });
});

describe("a range needs a spread, not just a number", () => {
  const area = (categoryAttributes.realEstate ?? []).find(
    (f) => f.key === "area",
  )!;
  const ptype = (categoryAttributes.realEstate ?? []).find(
    (f) => f.key === "ptype",
  )!;

  it("draws no range from a single value", () => {
    expect(attrRangeBounds(area, [{ attributes: { area: "140" } }])).toBeNull();
  });

  it("draws no range when every row holds the same value", () => {
    // A slider with one position is the `universal` case wearing a different hat.
    const same: AttrRow[] = [
      { attributes: { area: "140" } },
      { attributes: { area: "140" } },
    ];
    expect(attrRangeBounds(area, same)).toBeNull();
  });

  it("reports the real bounds when the rows spread", () => {
    const rows: AttrRow[] = [
      { attributes: { area: "140" } },
      { attributes: { area: "85" } },
      { attributes: { area: "300" } },
      { attributes: { area: "" } },
      { attributes: { area: "not a number" } },
    ];
    expect(attrRangeBounds(area, rows)).toEqual({ min: 85, max: 300 });
  });

  it("refuses to make a range out of a dropdown", () => {
    expect(
      attrRangeBounds(ptype, [
        { attributes: { ptype: "apartment" } },
        { attributes: { ptype: "land" } },
      ]),
    ).toBeNull();
  });
});
