// Structured business hours. Stored on stores.hours as jsonb keyed by JS
// weekday (0 = Sunday … 6 = Saturday); a missing key means closed that day.
// A null/empty object means the merchant hasn't configured hours yet — the
// UI then falls back to the legacy free-text opening_hours field and treats
// the store as open (never scare customers away on missing data).

export type DaySpan = { open: string; close: string };
export type WeekHours = Record<string, DaySpan>;

export const WEEK_DAYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** True/false when hours are configured; null when unknown (not configured). */
export function isOpenNow(
  hours: WeekHours | null | undefined,
  now: Date,
): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const span = hours[String(now.getDay())];
  if (!span) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
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
  return hours[String(date.getDay())] ?? null;
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
