import { describe, it, expect } from "vitest";
import {
  RENTAL_HOLDING_STATUSES,
  RENTAL_STATUSES,
  rentalDayPrices,
  rentalDays,
  rentalQuote,
  rentalRefusal,
  todayIso,
} from "@/lib/rental";

// MJ-003. The client half of the rental engine (migration 0298).
//
// The numbers below are not invented for the test: they are the numbers
// production returned when the migration was run inside a rolled-back
// transaction against it. A car at $30/day with a $40 Friday/Saturday rate,
// rented 2026-09-04 → 2026-09-07, priced at base 110 and grand total 115 with a
// $5 delivery fee, and reported a $200 deposit SEPARATELY. If this file and
// `rental_base_total()` ever disagree, one of them has drifted and the customer
// is being shown a price the server will not honour.

const CAR = {
  baseDailyPrice: 30,
  weekendPrice: 40,
  deliveryFee: 5,
  depositAmount: 200,
  minDays: 1,
  minDriverAge: 21,
};

describe("rentalDays", () => {
  it("counts the range half-open, like the exclusion constraint does", () => {
    expect(rentalDays("2026-09-04", "2026-09-07")).toBe(3);
    expect(rentalDays("2026-09-07", "2026-09-09")).toBe(2);
  });

  it("gives 0 for a same-day or inverted range rather than a negative", () => {
    // A same-day rental is an EMPTY daterange, which overlaps nothing and would
    // slide straight past the double-booking guard. 0298 refuses it with a
    // check constraint; here it must at least never produce a price.
    expect(rentalDays("2026-09-04", "2026-09-04")).toBe(0);
    expect(rentalDays("2026-09-07", "2026-09-04")).toBe(0);
  });

  it("survives a viewer in a negative-offset timezone", () => {
    // Parsed as UTC on purpose. `new Date("2026-09-04")` read in a local
    // negative offset lands on the 3rd, and a rental that loses a day at the
    // start of the range only breaks for customers in other zones.
    expect(rentalDays("2026-03-08", "2026-03-09")).toBe(1); // US DST boundary
    expect(rentalDays("2026-10-25", "2026-10-26")).toBe(1); // EU DST boundary
  });

  it("refuses to price something that is not a date", () => {
    expect(rentalDays("", "2026-09-07")).toBe(0);
    expect(rentalDays("2026-9-4", "2026-09-07")).toBe(0);
  });
});

describe("rentalDayPrices", () => {
  it("charges the weekend rate on Friday and Saturday only", () => {
    // 2026-09-04 is a Friday. Fri 40, Sat 40, Sun 30 — the same dow numbering
    // (5 and 6) that `extract(dow)` uses in rental_base_total().
    expect(rentalDayPrices(CAR, "2026-09-04", "2026-09-07")).toEqual([40, 40, 30]);
  });

  it("uses the base rate all week when no weekend rate was set", () => {
    expect(
      rentalDayPrices({ ...CAR, weekendPrice: null }, "2026-09-04", "2026-09-07"),
    ).toEqual([30, 30, 30]);
  });

  it("prices nothing for an empty range", () => {
    expect(rentalDayPrices(CAR, "2026-09-04", "2026-09-04")).toEqual([]);
  });
});

describe("rentalQuote", () => {
  it("reproduces what the server computed", () => {
    const q = rentalQuote(CAR, "2026-09-04", "2026-09-07");
    expect(q.days).toBe(3);
    expect(q.baseTotal).toBe(110);
    expect(q.deliveryFee).toBe(5);
    expect(q.grandTotal).toBe(115);
  });

  it("keeps the deposit OUT of the total", () => {
    // The whole point. Matjar processes no cards and holds no funds: the
    // merchant states a deposit and collects it in cash at pickup. Folding it
    // into the total would make the page read as though the platform were
    // charging it.
    const q = rentalQuote(CAR, "2026-09-04", "2026-09-07");
    expect(q.depositAmount).toBe(200);
    expect(q.grandTotal).toBe(115);
    expect(q.grandTotal).not.toBe(q.grandTotal + q.depositAmount);
    expect(q.baseTotal + q.deliveryFee).toBe(q.grandTotal);
  });

  it("treats a missing or negative fee as zero rather than as a discount", () => {
    const q = rentalQuote(
      { baseDailyPrice: 30, deliveryFee: -50, depositAmount: null },
      "2026-09-07",
      "2026-09-08",
    );
    expect(q.deliveryFee).toBe(0);
    expect(q.grandTotal).toBe(30);
    expect(q.depositAmount).toBe(0);
  });
});

describe("rentalRefusal", () => {
  const today = "2026-09-01";

  it("passes a rental that meets every stated rule", () => {
    expect(
      rentalRefusal({ pricing: CAR, pickup: "2026-09-04", ret: "2026-09-07", driverAge: 30, today }),
    ).toBeNull();
  });

  it("refuses the same four things the RPC refuses, by the same names", () => {
    expect(
      rentalRefusal({ pricing: CAR, pickup: "2026-09-04", ret: "2026-09-04", driverAge: 30, today }),
    ).toBe("invalid_range");
    expect(
      rentalRefusal({ pricing: CAR, pickup: "2026-08-30", ret: "2026-09-04", driverAge: 30, today }),
    ).toBe("past_date");
    expect(
      rentalRefusal({
        pricing: { ...CAR, minDays: 3 },
        pickup: "2026-09-04",
        ret: "2026-09-05",
        driverAge: 30,
        today,
      }),
    ).toBe("min_days");
    expect(
      rentalRefusal({ pricing: CAR, pickup: "2026-09-04", ret: "2026-09-07", driverAge: 19, today }),
    ).toBe("driver_too_young");
  });

  it("treats an unstated driver age as too young when the car sets a minimum", () => {
    // The server refuses `coalesce(p_driver_age, 0) < min_driver_age`, so a
    // blank field must not read as "no minimum applies".
    expect(
      rentalRefusal({ pricing: CAR, pickup: "2026-09-04", ret: "2026-09-07", driverAge: null, today }),
    ).toBe("driver_too_young");
  });

  it("lets a car with no age minimum take any driver", () => {
    expect(
      rentalRefusal({
        pricing: { ...CAR, minDriverAge: 0 },
        pickup: "2026-09-04",
        ret: "2026-09-07",
        driverAge: null,
        today,
      }),
    ).toBeNull();
  });

  it("allows a pickup today", () => {
    expect(
      rentalRefusal({ pricing: CAR, pickup: today, ret: "2026-09-03", driverAge: 30, today }),
    ).toBeNull();
  });
});

describe("the status vocabulary matches the constraint", () => {
  it("lists exactly the enum in 0298", () => {
    expect([...RENTAL_STATUSES]).toEqual([
      "requested",
      "confirmed",
      "declined",
      "picked_up",
      "returned",
      "completed",
      "cancelled",
      "no_show",
    ]);
  });

  it("holds the car for exactly the three statuses the exclusion clause names", () => {
    // `where (status in ('requested','confirmed','picked_up'))` on
    // rental_no_overlap. If this list and that clause drift, the merchant
    // screen will show days as free that the database still refuses to let go.
    expect([...RENTAL_HOLDING_STATUSES]).toEqual([
      "requested",
      "confirmed",
      "picked_up",
    ]);
    for (const s of RENTAL_HOLDING_STATUSES) {
      expect(RENTAL_STATUSES).toContain(s);
    }
    // Every other status releases the range — that is how declining frees a car.
    const releasing = RENTAL_STATUSES.filter(
      (s) => !RENTAL_HOLDING_STATUSES.includes(s),
    );
    expect(releasing).toEqual([
      "declined",
      "returned",
      "completed",
      "cancelled",
      "no_show",
    ]);
  });
});

describe("todayIso", () => {
  it("reads the viewer's own day, not UTC's", () => {
    // 2026-01-01T02:00 local. toISOString() in a positive-offset zone would
    // give 2025-12-31 and quietly make the earliest selectable pickup a day the
    // merchant will refuse.
    const d = new Date(2026, 0, 1, 2, 0, 0);
    expect(todayIso(d)).toBe("2026-01-01");
    expect(todayIso(new Date(2026, 8, 4, 23, 30))).toBe("2026-09-04");
  });
});
