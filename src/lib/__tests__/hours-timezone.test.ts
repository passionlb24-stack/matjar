import { describe, it, expect, vi } from "vitest";
import { isOpenNow, beirutClock, daySpan, type WeekHours } from "@/lib/hours";

// The bug these exist for was live on matjarlb.com and visible to customers:
// business hours were read with `now.getDay()` / `now.getHours()`, which is the
// SERVER's timezone. Vercel runs UTC and Beirut is three hours ahead, so every
// store carried a wrong status for six hours of every day — shown closed for
// the first three hours it was open, and open for three hours after it shut.
//
// Confirmed at 18:01 Beirut / 15:01 UTC: two shops closing at 18:00 both
// rendered «مفتوح هلأ» on production.
//
// These assertions are written against fixed instants, so they fail in exactly
// the way the old code was wrong, no matter what timezone CI runs in.

const NINE_TO_SIX: WeekHours = {
  "0": { open: "09:00", close: "18:00" },
  "1": { open: "09:00", close: "18:00" },
  "2": { open: "09:00", close: "18:00" },
  "3": { open: "09:00", close: "18:00" },
  "4": { open: "09:00", close: "18:00" },
  "5": { open: "09:00", close: "18:00" },
  "6": { open: "09:00", close: "18:00" },
};

describe("business hours are Beirut hours", () => {
  it("is closed one minute after closing, even though UTC says otherwise", () => {
    // 2026-08-22 15:01Z = 18:01 Beirut (summer, UTC+3). The shop shut at 18:00.
    // The old code compared 15:01 against 18:00 and said open.
    const t = new Date("2026-08-22T15:01:00Z");
    expect(isOpenNow(NINE_TO_SIX, t)).toBe(false);
  });

  it("is open in the morning, when UTC still thinks it is shut", () => {
    // 06:30Z = 09:30 Beirut. The old code compared 06:30 against 09:00 and said
    // closed — for the first three hours of every single working day.
    const t = new Date("2026-08-22T06:30:00Z");
    expect(isOpenNow(NINE_TO_SIX, t)).toBe(true);
  });

  it("follows Lebanon's DST instead of assuming a fixed offset", () => {
    // Winter is UTC+2, summer UTC+3. A hard-coded +3 would be an hour wrong for
    // half the year, which is the same class of bug one season later.
    const summer = beirutClock(new Date("2026-08-22T12:00:00Z")); // +3 → 15:00
    const winter = beirutClock(new Date("2026-01-22T12:00:00Z")); // +2 → 14:00
    expect(summer.minutes).toBe(15 * 60);
    expect(winter.minutes).toBe(14 * 60);
  });

  it("reads the weekday in Beirut, not UTC", () => {
    // 21:30Z Saturday is already 00:30 Sunday in Beirut. Reading the UTC
    // weekday would apply Saturday's hours to a Sunday shopper.
    const t = new Date("2026-08-22T21:30:00Z"); // Sat 21:30Z → Sun 00:30 Beirut
    const c = beirutClock(t);
    expect(c.dow).toBe(0);
    expect(c.minutes).toBe(30);
  });

  it("renders midnight as hour 0, not 24", () => {
    // `hour12: false` produces "24" for midnight on some engines, which would
    // put the store a whole day out at exactly the wrong moment.
    const c = beirutClock(new Date("2026-08-22T21:00:00Z")); // 00:00 Beirut
    expect(c.minutes).toBe(0);
    expect(c.dow).toBe(0);
  });

  it("still wraps an overnight span across midnight", () => {
    const late: WeekHours = {
      "0": { open: "18:00", close: "02:00" },
      "6": { open: "18:00", close: "02:00" },
    };
    // 22:00Z Sat = 01:00 Sun Beirut — inside Sunday's own overnight span.
    expect(isOpenNow(late, new Date("2026-08-22T22:00:00Z"))).toBe(true);
    // 12:00Z Sun = 15:00 Sun Beirut — after 02:00 and before 18:00.
    expect(isOpenNow(late, new Date("2026-08-23T12:00:00Z"))).toBe(false);
  });

  it("never consults the machine's local clock", () => {
    // The assertions above compare fixed UTC instants against Beirut hours, so
    // they fail loudly in CI, which runs UTC. They would NOT fail on a laptop
    // already set to Beirut — local time and Beirut agree there, which is
    // exactly how this survived review in the first place.
    //
    // This one holds in any timezone: it asserts the implementation never asks
    // the machine what time it is. `getHours`/`getDay` are the two getters
    // that carried the bug.
    const hours = vi.spyOn(Date.prototype, "getHours");
    const day = vi.spyOn(Date.prototype, "getDay");
    const minutes = vi.spyOn(Date.prototype, "getMinutes");
    try {
      isOpenNow(NINE_TO_SIX, new Date("2026-08-22T15:01:00Z"));
      beirutClock(new Date("2026-08-22T15:01:00Z"));
      // daySpan is in here because leaving it out is how it stayed broken:
      // isOpenNow was fixed, the assertions above were written against fixed
      // UTC instants, and every one of them passes on a laptop already set to
      // Beirut — which this one is. Only this spy fails everywhere.
      daySpan(NINE_TO_SIX, new Date("2026-08-22T15:01:00Z"));
      expect(hours).not.toHaveBeenCalled();
      expect(day).not.toHaveBeenCalled();
      expect(minutes).not.toHaveBeenCalled();
    } finally {
      hours.mockRestore();
      day.mockRestore();
      minutes.mockRestore();
    }
  });

  it("reads daySpan's weekday in Beirut too", () => {
    // This one was MISSED when isOpenNow was fixed, and the two failing
    // together is the whole point: store-header renders "today's hours" from
    // daySpan directly beside an open/closed badge from isOpenNow. Between
    // midnight and 03:00 Beirut, UTC is still on the previous day, so the badge
    // said one thing and the times beside it said another — about the same shop,
    // in the same card. Half-fixing a timezone turns a wrong answer into two
    // answers that disagree.
    const week: WeekHours = {
      "0": { open: "10:00", close: "14:00" }, // Sunday
      "6": { open: "08:00", close: "20:00" }, // Saturday
    };
    // 22:00Z Saturday is 01:00 SUNDAY in Beirut. The machine (UTC) still says
    // Saturday and would hand back 08:00–20:00.
    const t = new Date("2026-08-22T22:00:00Z");
    expect(beirutClock(t).dow).toBe(0);
    expect(daySpan(week, t)).toEqual({ open: "10:00", close: "14:00" });
  });

  it("agrees with isOpenNow about which day it is", () => {
    // The invariant that actually matters: whatever span daySpan hands the UI,
    // isOpenNow must have judged that same span. Checked across a full day of
    // instants, including the 21:00-24:00Z window where UTC and Beirut differ
    // on the date.
    const week: WeekHours = {
      "0": { open: "10:00", close: "14:00" },
      "1": { open: "09:00", close: "17:00" },
      "6": { open: "08:00", close: "20:00" },
    };
    for (let h = 0; h < 24; h++) {
      const t = new Date(Date.UTC(2026, 7, 22, h, 30));
      const span = daySpan(week, t);
      const open = isOpenNow(week, t);
      if (span == null) {
        // No span for that Beirut day means closed, never "unknown".
        expect(open, `${h}:30Z`).toBe(false);
      } else {
        const { minutes } = beirutClock(t);
        const [oh, om] = span.open.split(":").map(Number);
        const [ch, cm] = span.close.split(":").map(Number);
        const o = oh * 60 + om;
        const c = ch * 60 + cm;
        const expected = c <= o ? minutes >= o || minutes < c : minutes >= o && minutes < c;
        expect(open, `${h}:30Z against ${span.open}-${span.close}`).toBe(expected);
      }
    }
  });

  it("keeps unknown hours unknown", () => {
    // The platform's standing rule: never scare a customer away over missing
    // data. `null` is what callers turn into "treat as open".
    expect(isOpenNow(null, new Date())).toBeNull();
    expect(isOpenNow({}, new Date())).toBeNull();
  });

  it("is closed on a day the merchant did not configure", () => {
    const weekdaysOnly: WeekHours = {
      "1": { open: "09:00", close: "18:00" },
      "2": { open: "09:00", close: "18:00" },
    };
    // Sunday in Beirut.
    expect(isOpenNow(weekdaysOnly, new Date("2026-08-23T09:00:00Z"))).toBe(false);
  });
});
