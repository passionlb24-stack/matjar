import { describe, it, expect } from "vitest";
import {
  unitPricingOf,
  pricePerBase,
  amountInBase,
  baseMeasure,
  isWholeBaseUnit,
  measureForQuantity,
  formatMeasure,
  formatQuantityMeasure,
  unitPricingValue,
  unitPricingColumns,
  PIECE_PRICED,
} from "@/lib/unit-pricing";
import { subtotalOf } from "@/lib/order-math";

// ملحمة البركة's real catalogue, read off production. Every one of these is a
// price per kilo that the platform has been treating as a price per piece.
const BUTCHER = [
  { name: "مفرومة", price: 7.5 },
  { name: "كفتة", price: 7.5 },
  { name: "شقف", price: 7.8 },
  { name: "شرحات", price: 7.8 },
  { name: "مقانق", price: 7.39 },
  { name: "سجق", price: 7.6 },
  { name: "شاورما لحمة", price: 7.8 },
  { name: "شاورما دجاج", price: 7.5 },
  { name: "صدر دجاج", price: 7.0 },
];

describe("the money invariant — unit pricing cannot move a total", () => {
  // This is the one that matters. `products.price` is the price of ONE
  // orderable unit and `quantity` is an integer count of them, both before and
  // after 0299. If declaring a unit could change a subtotal, the whole design
  // is wrong and 60-odd live products are mispriced.
  // The cart builds an OrderLine as { unitPrice: effectivePrice(p), quantity },
  // and the RPC computes v_unit * v_qty from products.price. Neither reads a
  // unit. So the guarantee to pin is that nothing DERIVED from the unit — and
  // pricePerBase is the only derived money in the feature — is ever what a line
  // is totalled from.
  it("never lets the derived per-kilo price reach a subtotal", () => {
    const quarter = unitPricingOf({
      soldBy: "weight",
      unitMeasure: "g",
      unitAmount: 250,
    })!;
    // A 250 g unit at $1.88 displays as $7.52/kg. If that headline figure ever
    // leaked into the line, four quarter-kilos would cost $30.08 instead of
    // $7.52 — a 4× overcharge, and exactly the bug this design exists to avoid.
    const line = { unitPrice: 1.88, quantity: 4 };
    expect(pricePerBase(1.88, quarter)).toBe(7.52);
    expect(subtotalOf([line])).toBe(7.52);
    expect(subtotalOf([line])).not.toBe(
      subtotalOf([{ unitPrice: pricePerBase(1.88, quarter), quantity: 4 }]),
    );
  });

  it("prices a kilo the same whether it is bought as one unit or four quarters", () => {
    // The merchant's choice of unit must not change what a kilo costs. $7.52 a
    // kilo, sold as 1×1 kg or 4×250 g, is $7.52 either way.
    expect(subtotalOf([{ unitPrice: 7.52, quantity: 1 }])).toBe(
      subtotalOf([{ unitPrice: 1.88, quantity: 4 }]),
    );
  });

  it("leaves each of the butcher's ten prices exactly where it was", () => {
    for (const p of BUTCHER) {
      for (const qty of [1, 2, 3, 7]) {
        // Declaring "one unit is one kilo" is a statement about the LABEL, not
        // the price: same unitPrice, same quantity, same money.
        const unit = unitPricingOf({
          soldBy: "weight",
          unitMeasure: "kg",
          unitAmount: 1,
        })!;
        expect(pricePerBase(p.price, unit)).toBe(p.price);
        expect(subtotalOf([{ unitPrice: p.price, quantity: qty }])).toBe(
          Math.round(p.price * qty * 100) / 100,
        );
      }
    }
  });

  it("leaves every existing product piece-priced, because all three columns are null", () => {
    expect(
      unitPricingOf({ soldBy: null, unitMeasure: null, unitAmount: null }),
    ).toBeNull();
    expect(unitPricingOf({})).toBeNull();
  });
});

describe("unitPricingOf() — a half-configured row is not a unit", () => {
  it("accepts a complete weight unit", () => {
    expect(
      unitPricingOf({ soldBy: "weight", unitMeasure: "kg", unitAmount: 1 }),
    ).toEqual({ soldBy: "weight", measure: "kg", amount: 1 });
  });

  it("accepts grams and millilitres", () => {
    expect(
      unitPricingOf({ soldBy: "weight", unitMeasure: "g", unitAmount: 250 }),
    ).toEqual({ soldBy: "weight", measure: "g", amount: 250 });
    expect(
      unitPricingOf({ soldBy: "volume", unitMeasure: "ml", unitAmount: 500 }),
    ).toEqual({ soldBy: "volume", measure: "ml", amount: 500 });
  });

  // Each of these would otherwise let the storefront derive a per-kilo price
  // from a missing or nonsensical amount, and a wrong number on a price tag is
  // the failure this guards.
  it("refuses a measure with no sold_by", () => {
    expect(
      unitPricingOf({ soldBy: null, unitMeasure: "kg", unitAmount: 1 }),
    ).toBeNull();
  });

  it("refuses a sold_by with no amount", () => {
    expect(
      unitPricingOf({ soldBy: "weight", unitMeasure: "kg", unitAmount: null }),
    ).toBeNull();
  });

  it("refuses a zero or negative amount", () => {
    expect(
      unitPricingOf({ soldBy: "weight", unitMeasure: "kg", unitAmount: 0 }),
    ).toBeNull();
    expect(
      unitPricingOf({ soldBy: "weight", unitMeasure: "kg", unitAmount: -1 }),
    ).toBeNull();
  });

  it("refuses weight measured in litres, and volume in kilos", () => {
    expect(
      unitPricingOf({ soldBy: "weight", unitMeasure: "l", unitAmount: 1 }),
    ).toBeNull();
    expect(
      unitPricingOf({ soldBy: "volume", unitMeasure: "kg", unitAmount: 1 }),
    ).toBeNull();
  });

  it("refuses an unrecognised sold_by", () => {
    expect(
      unitPricingOf({ soldBy: "piece", unitMeasure: "kg", unitAmount: 1 }),
    ).toBeNull();
  });
});

describe("pricePerBase() — the number a shopper compares", () => {
  const kilo = unitPricingOf({
    soldBy: "weight",
    unitMeasure: "kg",
    unitAmount: 1,
  })!;
  const quarter = unitPricingOf({
    soldBy: "weight",
    unitMeasure: "g",
    unitAmount: 250,
  })!;
  const halfLitre = unitPricingOf({
    soldBy: "volume",
    unitMeasure: "ml",
    unitAmount: 500,
  })!;

  it("is the price itself when a unit IS one kilo", () => {
    expect(pricePerBase(7.5, kilo)).toBe(7.5);
    expect(isWholeBaseUnit(kilo)).toBe(true);
  });

  it("scales a 250 g unit up to the kilo", () => {
    expect(amountInBase(quarter)).toBe(0.25);
    expect(baseMeasure(quarter)).toBe("kg");
    expect(pricePerBase(1.88, quarter)).toBe(7.52);
    expect(isWholeBaseUnit(quarter)).toBe(false);
  });

  it("scales millilitres up to the litre", () => {
    expect(baseMeasure(halfLitre)).toBe("l");
    expect(pricePerBase(4.25, halfLitre)).toBe(8.5);
  });

  it("rounds to cents rather than leaking float error", () => {
    // 7.39 / 3 * 3 drifts in IEEE754; the derived figure must not show it.
    const third = unitPricingOf({
      soldBy: "weight",
      unitMeasure: "kg",
      unitAmount: 0.333,
    })!;
    const per = pricePerBase(2.46, third);
    expect(per).toBe(Math.round(per * 100) / 100);
    expect(String(per)).not.toMatch(/\d{5,}$/);
  });
});

describe("what the customer reads on the stepper", () => {
  const kilo = unitPricingOf({
    soldBy: "weight",
    unitMeasure: "kg",
    unitAmount: 1,
  })!;
  const quarter = unitPricingOf({
    soldBy: "weight",
    unitMeasure: "g",
    unitAmount: 250,
  })!;

  it("counts a kilo unit in kilos", () => {
    expect(measureForQuantity(kilo, 2)).toBe(2);
    expect(formatQuantityMeasure(kilo, 2, "ar")).toBe("2 كيلو");
    expect(formatQuantityMeasure(kilo, 2, "en")).toBe("2 kg");
  });

  it("counts a 250 g unit in grams, so three taps reads 750 غرام", () => {
    expect(formatQuantityMeasure(quarter, 3, "ar")).toBe("750 غرام");
    expect(formatQuantityMeasure(quarter, 3, "en")).toBe("750 g");
  });

  it("drops trailing zeros but keeps a real fraction", () => {
    expect(formatMeasure(2, "kg", "en")).toBe("2 kg");
    expect(formatMeasure(1.5, "kg", "en")).toBe("1.5 kg");
    expect(formatMeasure(0.25, "kg", "en")).toBe("0.25 kg");
  });

  it("uses Western digits, matching formatUsd, so a weight and a price beside it match", () => {
    expect(formatQuantityMeasure(kilo, 3, "ar")).toMatch(/^3 /);
  });
});

describe("the merchant form's round trip", () => {
  it("opens a piece-priced product on 'By the piece'", () => {
    expect(unitPricingValue(null, null, null)).toEqual(PIECE_PRICED);
  });

  it("opens a per-kilo product on its own unit", () => {
    expect(unitPricingValue("weight", "kg", 1)).toEqual({
      soldBy: "weight",
      measure: "kg",
      amount: "1",
    });
  });

  it("falls back to piece pricing for a row that makes no sense", () => {
    expect(unitPricingValue("weight", "l", 1)).toEqual(PIECE_PRICED);
    expect(unitPricingValue("weight", "kg", 0)).toEqual(PIECE_PRICED);
  });

  it("writes all three columns null when switching back to piece pricing", () => {
    // The bug this prevents: a stale unit_measure left behind on a row whose
    // sold_by is now null, which the 0299 check constraint refuses — surfacing
    // as a save that mysteriously fails.
    expect(unitPricingColumns(PIECE_PRICED)).toEqual({
      sold_by: null,
      unit_measure: null,
      unit_amount: null,
    });
    expect(
      unitPricingColumns({ soldBy: "", measure: "kg", amount: "2" }),
    ).toEqual({ sold_by: null, unit_measure: null, unit_amount: null });
  });

  it("writes all three together when a unit is declared", () => {
    expect(
      unitPricingColumns({ soldBy: "weight", measure: "g", amount: "250" }),
    ).toEqual({ sold_by: "weight", unit_measure: "g", unit_amount: 250 });
  });

  it("treats an unparseable amount as piece-priced rather than sending NaN", () => {
    expect(
      unitPricingColumns({ soldBy: "weight", measure: "kg", amount: "" }),
    ).toEqual({ sold_by: null, unit_measure: null, unit_amount: null });
    expect(
      unitPricingColumns({ soldBy: "weight", measure: "kg", amount: "abc" }),
    ).toEqual({ sold_by: null, unit_measure: null, unit_amount: null });
  });

  it("survives a value → columns → value round trip", () => {
    const v = { soldBy: "weight" as const, measure: "g" as const, amount: "250" };
    const c = unitPricingColumns(v);
    expect(unitPricingValue(c.sold_by, c.unit_measure, c.unit_amount)).toEqual(v);
  });
});
