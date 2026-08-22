import { describe, it, expect, vi } from "vitest";
import { isOpenNow, beirutClock, type WeekHours } from "@/lib/hours";

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
      expect(hours).not.toHaveBeenCalled();
      expect(day).not.toHaveBeenCalled();
      expect(minutes).not.toHaveBeenCalled();
    } finally {
      hours.mockRestore();
      day.mockRestore();
      minutes.mockRestore();
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
