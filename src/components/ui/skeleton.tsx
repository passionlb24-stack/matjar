// The one loading placeholder. Replaces ad-hoc `animate-pulse bg-*` divs.
// Uses the `.shimmer` utility from globals.css (a sweeping highlight); the
// global prefers-reduced-motion guard turns it into a calm static fill.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} aria-hidden="true" />;
}

/** A block of shimmering text lines; the last line is shorter, like real text. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`shimmer h-3.5 rounded ${
            i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}

/** A card-shaped placeholder matching ui/card.tsx's frame. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-xs ${className}`}
      aria-hidden="true"
    >
      <div className="shimmer h-10 w-10 rounded-xl" />
      <div className="shimmer mt-4 h-4 w-3/5 rounded" />
      <div className="mt-3 space-y-2">
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-4/5 rounded" />
      </div>
    </div>
  );
}
