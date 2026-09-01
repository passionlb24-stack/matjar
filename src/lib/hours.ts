// Structured business hours. Stored on stores.hours as jsonb keyed by JS
// weekday (0 = Sunday … 6 = Saturday); a missing key means closed that day.
// A null/empty object means the merchant hasn't configured hours yet — the UI
// then shows no hours at all and treats the store as open (never scare a
// customer away on missing data). There used to be a free-text opening_hours
// field standing in for this; it is retired (0244), because a sentence that
// can disagree with the open/closed badge beside it is worse than silence.

export type DaySpan = { open: string; close: string };
export type WeekHours = Record<string, DaySpan>;

export const WEEK_DAYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// A merchant writes "09:00–18:00" meaning Beirut, always. Nothing else is
// plausible: every shop on this platform is in Lebanon.
//
// This used to be read with `now.getDay()` and `now.getHours()`, which is
// whatever timezone the machine happens to be in. On the server that is UTC,
// and Beirut runs three hours ahead — so every store on the platform carried a
// status that was wrong for six hours of every day: shown CLOSED for the first
// three hours it was actually open, and OPEN for three hours after it shut.
//
// Caught on production rather than by reading: at 18:01 Beirut, two shops whose
// hours end at 18:00 both rendered «مفتوح هلأ». UTC was 15:01, which is exactly
// what the old arithmetic would conclude.
//
// Intl rather than a fixed +3, because Lebanon keeps DST: the offset is +2 in
// winter and +3 in summer, and a hard-coded number would be wrong for half the
// year in the other direction. `h23` because `hour12: false` renders midnight
// as "24" on some engines, which would put it a day out.
//
// It also removes a hydration hazard. This runs on the server AND in the
// browser, where `getHours()` was the visitor's own timezone — so the same
// store could render open on the server and closed on the client for anyone
// outside Beirut. Both sides now ask the same question.
const BEIRUT_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Beirut",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** The weekday (0–6, Sunday first, matching the `hours` keys) and minutes past
 *  midnight, in Beirut, for an instant. */
export function beirutClock(now: Date): { dow: number; minutes: number } {
  let dow = 0;
  let hour = 0;
  let minute = 0;
  for (const part of BEIRUT_CLOCK.formatToParts(now)) {
    if (part.type === "weekday") dow = DOW[part.value] ?? 0;
    else if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
  }
  return { dow, minutes: hour * 60 + minute };
}

/** True/false when hours are configured; null when unknown (not configured). */
export function isOpenNow(
  hours: WeekHours | null | undefined,
  now: Date,
): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const { dow, minutes: cur } = beirutClock(now);
  const span = hours[String(dow)];
  if (!span) return false;
  const open = toMinutes(span.open);
  const close = toMinutes(span.close);
  // Overnight spans (e.g. 18:00–02:00) wrap past midnight.
  if (close <= open) return cur >= open || cur < close;
  return cur >= open && cur < close;
}

/** The configured span for a given date, or null when closed/unconfigured. */
export function daySpan(
  hours: WeekHours | null | undefined,
  date: Date,
): DaySpan | null {
  if (!hours) return null;
  // Beirut's weekday, for the same reason isOpenNow() above uses Beirut's
  // clock — and this one was missed when that was fixed, which is worth
  // recording because of how the two failed TOGETHER.
  //
  // `date.getDay()` is the machine's weekday. On a UTC server, between
  // midnight and 03:00 in Beirut it is still the previous day, so this returned
  // yesterday's opening times. store-header.tsx renders "today's hours" from
  // this line directly beside an open/closed badge computed by isOpenNow() —
  // so in that window the badge said one thing and the times beside it said
  // another, about the same shop, in the same card.
  //
  // Half-fixing a timezone is worse than not fixing it: it turns one wrong
  // answer into two answers that contradict each other.
  return hours[String(beirutClock(date).dow)] ?? null;
}

/** Bookable "HH:MM" slots for one day's span at a given granularity. */
export function generateSlots(span: DaySpan, slotMinutes: number): string[] {
  const step = Math.max(5, slotMinutes || 30);
  const open = toMinutes(span.open);
  let close = toMinutes(span.close);
  if (close <= open) close += 24 * 60; // overnight
  const slots: string[] = [];
  for (let t = open; t + step <= close; t += step) {
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    slots.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  }
  return slots;
}

/** Safe parse for the jsonb column (tolerates bad/legacy data). */
export function parseHours(raw: unknown): WeekHours | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: WeekHours = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!WEEK_DAYS.includes(k as (typeof WEEK_DAYS)[number])) continue;
    const s = v as { open?: unknown; close?: unknown } | null;
    if (
      s &&
      typeof s.open === "string" &&
      typeof s.close === "string" &&
      /^\d{2}:\d{2}$/.test(s.open) &&
      /^\d{2}:\d{2}$/.test(s.close)
    ) {
      out[k] = { open: s.open, close: s.close };
    }
  }
  return Object.keys(out).length ? out : null;
}
