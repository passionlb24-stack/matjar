// ===== OS dashboard — RevenueChart =====
// Last-14-days stacked daily revenue (online + POS), pure CSS like the reports
// page but dressed up: gradient bars, a native hover tooltip per day, and
// "today" highlighted with a tinted column + bold label. No client JS.

export function RevenueChart({
  days,
  legendOnline,
  legendPos,
  todayLabel,
  hasPos,
  empty,
}: {
  days: {
    label: string;
    online: number;
    pos: number;
    isToday: boolean;
    tooltip: string;
  }[];
  legendOnline: string;
  legendPos: string;
  todayLabel: string;
  hasPos: boolean;
  empty: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.online + d.pos));
  const allZero = days.every((d) => d.online + d.pos === 0);

  if (allZero) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 170 }}>
        {days.map((d) => {
          const total = d.online + d.pos;
          return (
            <div
              key={d.label}
              title={d.tooltip}
              className={`group flex h-full flex-1 flex-col justify-end rounded-lg px-px pt-1 transition-colors ${
                d.isToday ? "bg-primary-soft/60" : "hover:bg-surface-muted/70"
              }`}
            >
              {d.pos > 0 && (
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-amber-400 to-amber-300 transition-opacity group-hover:opacity-80"
                  style={{ height: `${(d.pos / max) * 100}%` }}
                />
              )}
              {d.online > 0 && (
                <div
                  className={`w-full bg-gradient-to-t from-primary to-primary/70 transition-opacity group-hover:opacity-80 ${
                    d.pos > 0 ? "" : "rounded-t-md"
                  }`}
                  style={{ height: `${(d.online / max) * 100}%` }}
                />
              )}
              {total === 0 && (
                <div className="h-1 w-full rounded-full bg-surface-muted" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {days.map((d, i) => (
          <span
            key={d.label}
            className={`flex-1 text-center text-[9px] font-medium ${
              d.isToday
                ? "font-bold text-primary"
                : "text-muted-foreground"
            }`}
          >
            {d.isToday ? todayLabel : i % 2 === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          {legendOnline}
        </span>
        {hasPos && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
            {legendPos}
          </span>
        )}
      </div>
    </div>
  );
}
