import { describe, it, expect } from "vitest";
import { slotsKey, slotsLoading } from "@/lib/booking-slots";

const RES = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("slotsKey", () => {
  it("is null until both a resource and a date are chosen", () => {
    expect(slotsKey(null, "2026-08-05", false)).toBeNull();
    expect(slotsKey(RES, null, false)).toBeNull();
    expect(slotsKey("", "2026-08-05", false)).toBeNull();
    expect(slotsKey(RES, "", false)).toBeNull();
  });

  it("changes with the day", () => {
    expect(slotsKey(RES, "2026-08-05", false)).not.toBe(
      slotsKey(RES, "2026-08-06", false),
    );
  });

  it("changes with the resource", () => {
    expect(slotsKey(RES, "2026-08-05", false)).not.toBe(
      slotsKey(OTHER, "2026-08-05", false),
    );
  });

  // Completing a booking has to re-fetch the same day: the slot just taken is
  // no longer free. Without `done` in the key the list would look loaded and
  // still offer the slot that was booked a second ago.
  it("changes after a booking completes, so the same day refetches", () => {
    expect(slotsKey(RES, "2026-08-05", false)).not.toBe(
      slotsKey(RES, "2026-08-05", true),
    );
  });

  it("is stable for the same inputs", () => {
    expect(slotsKey(RES, "2026-08-05", false)).toBe(
      slotsKey(RES, "2026-08-05", false),
    );
  });
});

describe("slotsLoading", () => {
  it("is false when there is nothing to load", () => {
    expect(slotsLoading(null, null)).toBe(false);
    expect(slotsLoading(null, "anything")).toBe(false);
  });

  it("is true before anything has been loaded", () => {
    expect(slotsLoading(slotsKey(RES, "2026-08-05", false), null)).toBe(true);
  });

  it("is false once the loaded data matches the selection", () => {
    const key = slotsKey(RES, "2026-08-05", false);
    expect(slotsLoading(key, key)).toBe(false);
  });

  // The frame this replaces: the day changed, the old day's slots were still on
  // screen, and nothing said they were stale.
  it("goes back to loading the moment the day changes", () => {
    const loaded = slotsKey(RES, "2026-08-05", false);
    const nowShowing = slotsKey(RES, "2026-08-06", false);
    expect(slotsLoading(nowShowing, loaded)).toBe(true);
  });

  it("goes back to loading when the resource changes", () => {
    const loaded = slotsKey(RES, "2026-08-05", false);
    const nowShowing = slotsKey(OTHER, "2026-08-05", false);
    expect(slotsLoading(nowShowing, loaded)).toBe(true);
  });
});
