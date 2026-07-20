import type { ReactNode } from "react";

// The one KPI tile. Replaces the ad-hoc stat cards on merchant/admin
// dashboards. Value uses tabular-nums so columns of numbers align; delta is a
// percent that renders ▲ green / ▼ red. Wrap a row of them in <StatGrid>.

export function Stat({
  label,
  value,
  delta,
  icon,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  /** Percent change vs. the previous period; sign picks arrow + color. */
  delta?: number;
  icon?: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {icon && (
          <span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-2xl font-extrabold tracking-tight tabular-nums">
          {value}
        </p>
        {typeof delta === "number" && (
          <span
            dir="ltr"
            className={`text-xs font-bold tabular-nums ${
              delta >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Standard KPI row: 2-up on mobile, 4-up on desktop. */
export function StatGrid({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {children}
    </div>
  );
}
