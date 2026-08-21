import { describe, it, expect } from "vitest";
import { deliveryWindows, scheduledForIso } from "@/lib/delivery-windows";
import type { WeekHours } from "@/lib/hours";

// ملحمة البركة's real hours, read off production (stores.hours). Sunday is 0.
const BUTCHER: WeekHours = {
  "0": { open: "09:00", close: "20:00" },
  "1": { open: "09:00", close: "21:00" },
  "2": { open: "09:00", close: "20:00" },
  "3": { open: "09:00", close: "20:00" },
  "4": { open: "09:00", close: "20:00" },
  "5": { open: "09:00", close: "20:00" },
  "6": { open: "09:00", close: "20:00" },
};

// misk's real hours: closed Saturday and Sunday.
const WEEKDAYS_ONLY: WeekHours = {
  "1": { open: "09:00", close: "18:00" },
  "2": { open: "09:00", close: "18:00" },
  "3": { open: "09:00", close: "18:00" },
  "4": { open: "09:00", close: "18:00" },
  "5": { open: "09:00", close: "18:00" },
};

/** A local-time Date, so these tests read the same way the picker does. */
const at = (iso: string) => new Date(iso);

describe("deliveryWindows() — only times the shop is actually open", () => {
  it("offers nothing when the merchant has set no hours, so the picker hides", () => {
    expect(deliveryWindows(null, at("2026-08-20T10:00"))).toEqual([]);
    expect(deliveryWindows({}, at("2026-08-20T10:00"))).toEqual([]);
    expect(deliveryWindows(undefined, at("2026-08-20T10:00"))).toEqual([]);
  });

  it("never offers a time before the shop opens", () => {
    // 07:00 on a Thursday. The butcher opens at 09:00.
    const w = deliveryWindows(BUTCHER, at("2026-08-20T07:00"));
    expect(w[0].slots[0]).toBe("09:00");
  });

  it("never offers a time after the shop closes", () => {
    const w = deliveryWindows(BUTCHER, at("2026-08-20T07:00"));
    // Closes 20:00, so the last hour-long slot starts at 19:00.
    expect(w[0].slots.at(-1)).toBe("19:00");
    expect(w[0].slots).not.toContain("20:00");
  });

  // This is the defect the existing product-page picker has: a bare
  // datetime-local takes 03:00 on a Sunday without complaint.
  it("cannot be asked for 3am", () => {
    const w = deliveryWindows(BUTCHER, at("2026-08-20T07:00"));
    for (const day of w) {
      expect(day.slots).not.toContain("03:00");
      expect(day.slots.every((s) => s >= "09:00" && s < "21:00")).toBe(true);
    }
  });

  it("drops today's slots that have already passed, plus the lead time", () => {
    // 14:10 on a Thursday, 45 minutes' lead → earliest is 14:55, so 15:00.
    const w = deliveryWindows(BUTCHER, at("2026-08-20T14:10"));
    expect(w[0].slots[0]).toBe("15:00");
    expect(w[0].slots).not.toContain("14:00");
  });

  it("drops today entirely once the shop is closing", () => {
    // 19:30 Thursday: the 19:00 slot has gone and 20:00 is past closing.
    const w = deliveryWindows(BUTCHER, at("2026-08-20T19:30"));
    expect(w[0].date).not.toBe("2026-08-20");
    // The next offered day is tomorrow, from opening.
    expect(w[0].date).toBe("2026-08-21");
    expect(w[0].slots[0]).toBe("09:00");
  });

  it("skips days the shop is closed", () => {
    // Friday 2026-08-21. misk is open Mon–Fri, so Sat/Sun are absent.
    const w = deliveryWindows(WEEKDAYS_ONLY, at("2026-08-21T10:00"));
    const dates = w.map((d) => d.date);
    expect(dates).toContain("2026-08-21"); // Friday
    expect(dates).not.toContain("2026-08-22"); // Saturday
    expect(dates).not.toContain("2026-08-23"); // Sunday
    expect(dates).toContain("2026-08-24"); // Monday
  });

  it("respects the lead time only for today, not for later days", () => {
    const w = deliveryWindows(BUTCHER, at("2026-08-20T14:10"));
    expect(w[0].slots[0]).toBe("15:00"); // today, clock applies
    expect(w[1].slots[0]).toBe("09:00"); // tomorrow, from opening
  });

  it("builds dates in local time, so a late-evening order does not skip a day", () => {
    // toISOString() on a late local time rolls to the next UTC date in any
    // timezone east of UTC — Beirut is UTC+3 — which would label today as
    // tomorrow and silently drop a day from the picker.
    const w = deliveryWindows(BUTCHER, at("2026-08-20T23:30"));
    expect(w[0].date).toBe("2026-08-21");
  });

  it("honours the day horizon", () => {
    expect(deliveryWindows(BUTCHER, at("2026-08-20T10:00"), { days: 3 })).toHaveLength(3);
    expect(deliveryWindows(BUTCHER, at("2026-08-20T10:00"))).toHaveLength(7);
  });

  it("honours the slot granularity", () => {
    const w = deliveryWindows(BUTCHER, at("2026-08-20T07:00"), {
      slotMinutes: 30,
    });
    expect(w[0].slots.slice(0, 3)).toEqual(["09:00", "09:30", "10:00"]);
  });
});

describe("scheduledForIso() — what actually reaches the RPC", () => {
  it("sends nothing when the customer has not chosen both halves", () => {
    // An ordinary order-now, which is what every order has been until now.
    expect(scheduledForIso("", "")).toBeNull();
    expect(scheduledForIso("2026-08-21", "")).toBeNull();
    expect(scheduledForIso("", "18:00")).toBeNull();
  });

  it("treats the chosen time as the customer's local time", () => {
    const iso = scheduledForIso("2026-08-21", "18:00")!;
    const d = new Date(iso);
    expect(d.getHours()).toBe(18);
    expect(d.getDate()).toBe(21);
  });

  it("returns null rather than an Invalid Date for nonsense", () => {
    expect(scheduledForIso("not-a-date", "18:00")).toBeNull();
  });
});
