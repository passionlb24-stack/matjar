import type { LucideIcon } from "lucide-react";

/**
 * The heading over one KIND of result, with the count that came from the query.
 *
 * The phone screen groups by kind — «المتاجر — 8», «منتجات وخدمات — 11» — because
 * on a 390px column a buyer is scrolling a single stack and needs to know what
 * they are scrolling through. Desktop keeps the headings it already had, which
 * is why this renders two labels and two count shapes rather than one: the `lg`
 * half reproduces the existing markup exactly, and the base half is the new
 * phone reading. Nothing here is styled by hiding the other one badly — both
 * spellings are in the DOM and each is display:none at the other's width.
 *
 * `count` is a number handed in by the page, which read it off the array the
 * query returned. There is no place in this component to invent one, and that
 * is deliberate: a heading that says 12 when 8 rows follow is worse than no
 * heading at all.
 */
export function KindHeading({
  id,
  icon: Icon,
  label,
  desktopLabel,
  count,
  className = "",
}: {
  id: string;
  icon: LucideIcon;
  /** The phone reading — the kind, as a buyer would name it. */
  label: string;
  /** The wording desktop already shows. Omitted for the stores group, which has
   *  no kind heading on desktop at all (it is split by sector there), so the
   *  whole heading then disappears above `lg`. */
  desktopLabel?: string;
  count: number;
  className?: string;
}) {
  const onDesktop = desktopLabel !== undefined;
  return (
    <h2
      id={id}
      className={`mb-4 flex items-center gap-2 text-lg font-extrabold ${onDesktop ? "" : "lg:hidden"} ${className}`}
    >
      <Icon aria-hidden className="h-5 w-5 shrink-0 text-primary" />
      {onDesktop ? (
        <>
          <span className="lg:hidden">{label}</span>
          <span className="hidden lg:inline">{desktopLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {/* An em dash, not a bracket, at phone width: «المتاجر — 8» reads as a
          label and its size, where «المتاجر (8)» reads as a footnote. It is
          aria-hidden because a screen reader announcing "dash" between the two
          is noise — the number follows the name either way. */}
      <span aria-hidden className="text-muted-foreground lg:hidden">
        —
      </span>
      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        <span className="lg:hidden">{count}</span>
        <span className="hidden lg:inline">({count})</span>
      </span>
    </h2>
  );
}
