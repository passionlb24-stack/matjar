import { Clock } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { WEEK_DAYS, daySpan, type WeekHours } from "@/lib/hours";

// The full week, not just today. The header already answers "open right now?";
// it cannot answer "can I come on Saturday?" — and for a clinic that closes at
// 15:00 on weekdays and never opens on Sunday, that second question is the one
// that decides whether the booking calendar underneath is worth opening at all.
//
// Renders from stores.hours only. A store that never configured a grid gets no
// section rather than a card full of dashes: parseHours returns null and the
// page's own condition drops the whole block.
export function StoreHours({
  hours,
  now,
  dict,
}: {
  hours: WeekHours;
  /** Read once on the server per request, so every row agrees on "today". */
  now: Date;
  dict: Dictionary;
}) {
  const t = dict.os.hours;
  const dayNames = t.days as Record<string, string>;
  const todayKey = String(now.getDay());
  const today = daySpan(hours, now);

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Clock className="h-5 w-5 text-primary" />
        {t.title}
      </h2>
      <ul className="grid gap-1 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2 sm:gap-x-6">
        {WEEK_DAYS.map((d) => {
          const span = hours[d];
          const isToday = d === todayKey;
          return (
            <li
              key={d}
              {...(isToday ? { "aria-current": "date" as const } : {})}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                isToday ? "bg-primary-soft" : ""
              }`}
            >
              <span
                className={`flex min-w-0 items-center gap-2 truncate ${
                  isToday ? "font-bold text-primary" : "font-semibold"
                }`}
              >
                {dayNames[d]}
                {isToday && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    {dict.store.hoursToday}
                  </span>
                )}
              </span>
              {span ? (
                <span
                  dir="ltr"
                  className={`shrink-0 tabular-nums ${
                    isToday ? "font-bold text-primary" : "text-muted-foreground"
                  }`}
                >
                  {span.open}–{span.close}
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground">
                  {t.closed}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!today && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {dict.store.hoursClosedToday}
        </p>
      )}
    </section>
  );
}
