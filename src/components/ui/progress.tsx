// The one progress bar. Replaces ad-hoc width-styled divs (loyalty progress,
// stock levels, profile completeness). Thin rounded track with semantic tones;
// fills from the inline start, so it is RTL-correct with no extra work.

type ProgressTone = "primary" | "success" | "warning" | "danger" | "info";

const progressTones: Record<ProgressTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function Progress({
  value,
  tone = "primary",
  label,
  className = "",
}: {
  /** 0–100; clamped. */
  value: number;
  tone?: ProgressTone;
  /** Accessible name for the bar (e.g. "اكتمال الملف"). */
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-muted ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${progressTones[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
