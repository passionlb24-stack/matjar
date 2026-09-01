import { Clock } from "lucide-react";

import { beirutClock, isOpenNow, parseHours } from "@/lib/hours";
import { lookup, type ProfessionalDict } from "./copy";

// The weekly hours grid.
//
// ===== Beirut, not the machine =====
//
// A tradesman writes "08:00–17:00" meaning Beirut. Nothing else is plausible —
// every professional on this platform is in Lebanon — and the server this runs
// on is in UTC, three hours behind in summer and two in winter. Reading
// `getDay()`/`getHours()` off a Date is what had every store on the platform
// showing the wrong open/closed state for six hours of every day until two days
// ago: CLOSED for the first three hours it was actually open, OPEN for three
// hours after it shut.
//
// So the weekday and the open/closed verdict both come from src/lib/hours.ts —
// `beirutClock()` and `isOpenNow()`, which resolve the zone through Intl and
// therefore also follow Lebanon's DST rather than a hard-coded +3. This
// component does no date arithmetic of its own, and must not start.
//
// Note it does NOT use `daySpan()` from that module: `daySpan` still indexes on
// `date.getDay()`, so between midnight and 3am Beirut it returns the previous
// day's span. The row highlighted here is indexed on `beirutClock().dow`
// instead.
//
// ===== Unknown is not closed =====
//
// `isOpenNow` returns `null` when hours are not configured, and null means
// unknown. The platform's standing rule is never to scare a customer away over
// missing data, so an unknown state renders no badge at all rather than a
// "closed" one. In practice this component returns null long before that,
// because unconfigured hours also mean there is no grid to draw.
//
// ===== Unverifiable today =====
//
// `hours` is null for every professional on the platform, so this block ships
// invisible: there is no craftsman and no freelancer whose grid could be
// rendered against real data. It has been exercised against fixtures only.

export function ProfessionalAvailability({
  hours,
  dict,
  now,
  title,
  id,
  className = "",
}: {
  /** `profile.hours` — jsonb of unknown shape, parsed defensively. */
  hours?: unknown;
  dict: ProfessionalDict;
  /**
   * The instant to read "now" as. Defaults to render time; pass the request's
   * pinned clock (src/lib/now.ts) where the page reads the clock more than
   * once, so the badge and the highlighted row cannot land on either side of a
   * boundary.
   */
  now?: Date;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  const week = parseHours(hours);
  // Nothing configured — and that is everyone, today. No grid, no "hours not
  // set" box on a page a customer is reading.
  if (!week) return null;

  const t = dict.professional.availability;
  const heading = title === undefined ? t.title : title;
  const at = now ?? new Date();
  const open = isOpenNow(week, at);
  const { dow } = beirutClock(at);

  return (
    <section id={id} className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {heading && <h2 className="text-lg font-extrabold">{heading}</h2>}
        {/* `open === null` is unknown, not closed — no badge. */}
        {open != null && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              open ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {open ? t.openNow : t.closedNow}
          </span>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const span = week[String(d)];
          const today = d === dow;
          return (
            <li
              key={d}
              aria-current={today ? "date" : undefined}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                today ? "bg-surface-muted" : ""
              }`}
            >
              <span
                className={`flex items-center gap-2 ${today ? "font-bold" : ""}`}
              >
                {lookup(t.days, String(d)) ?? ""}
                {today && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
                    {t.today}
                  </span>
                )}
              </span>

              {span ? (
                // A range of two clock times is a run of digits and neutrals:
                // in an RTL paragraph bidi reorders it and "08:00–17:00" comes
                // out reversed. The isolate pins it, tabular figures keep the
                // column aligned.
                <span
                  dir="ltr"
                  className={`tabular-nums ${today ? "font-bold" : "text-muted-foreground"}`}
                >
                  {span.open}–{span.close}
                </span>
              ) : (
                <span className="text-muted-foreground">{t.closed}</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">
        <Clock className="me-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
        {t.note}
      </p>
    </section>
  );
}
