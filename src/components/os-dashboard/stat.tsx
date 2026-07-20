import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

// ===== OS dashboard — Stat =====
// One KPI: muted label on top, strong tabular value, optional colored delta
// and hint. Local to the dashboard so it can evolve with it (per the design
// rule: dashboards read as "few strong numbers", not walls of equal boxes).

export function Delta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${
        up ? "text-success" : "text-danger"
      }`}
    >
      {up ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {Math.abs(pct)}%
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  pct,
  href,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Period-over-period % delta (▲ green / ▼ red). */
  pct?: number;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={`mt-1.5 flex items-baseline gap-2 text-2xl font-extrabold tabular-nums tracking-tight ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
        {typeof pct === "number" && <Delta pct={pct} />}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/80">
          {hint}
        </p>
      )}
    </>
  );
  const base = `rounded-2xl border p-4 shadow-xs ${
    highlight ? "border-primary/30 bg-primary-soft/50" : "border-border bg-surface"
  }`;
  if (href) {
    return (
      <Link
        href={href}
        className={`${base} block transition-all hover:-translate-y-0.5 hover:shadow-md`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
