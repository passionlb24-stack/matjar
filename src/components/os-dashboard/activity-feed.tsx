import { ShoppingBag, CalendarCheck, Zap, Activity } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { WidgetCard } from "./widget-card";

// ===== OS dashboard — ActivityFeed =====
// The store's heartbeat: recent orders + bookings + automation runs merged
// into one stream, newest first. Read-only by design — each row is a glance,
// the widgets above are where action happens.

export type ActivityRow = {
  id: string;
  kind: "order" | "booking" | "automation";
  text: string;
  meta?: string;
  createdAt: string;
};

const KIND_STYLE: Record<
  ActivityRow["kind"],
  { Icon: typeof Zap; chip: string }
> = {
  order: { Icon: ShoppingBag, chip: "bg-primary-soft text-primary" },
  booking: { Icon: CalendarCheck, chip: "bg-violet-100 text-violet-600" },
  automation: { Icon: Zap, chip: "bg-amber-100 text-amber-600" },
};

function timeAgo(iso: string, lang: Locale) {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return rtf.format(0, "minute");
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return rtf.format(-hrs, "hour");
  const days = Math.round(hrs / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  return rtf.format(-months, "month");
}

export function ActivityFeed({
  title,
  empty,
  rows,
  lang,
}: {
  title: string;
  empty: string;
  rows: ActivityRow[];
  lang: Locale;
}) {
  return (
    <WidgetCard title={title} Icon={Activity}>
      {rows.length ? (
        <ul className="space-y-1">
          {rows.map((r) => {
            const { Icon, chip } = KIND_STYLE[r.kind];
            return (
              <li
                key={`${r.kind}-${r.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted/60"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.text}
                  {r.meta && (
                    <span className="ms-1.5 text-xs font-bold tabular-nums text-muted-foreground">
                      {r.meta}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {timeAgo(r.createdAt, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </WidgetCard>
  );
}
