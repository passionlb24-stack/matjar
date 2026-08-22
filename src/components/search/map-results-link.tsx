import Link from "next/link";
import { MapPin } from "lucide-react";
import { ChevronNext } from "@/components/ui/directional-icon";

/**
 * "شوف كل النتائج على الخريطة" — offered only when there is a map to show.
 *
 * Seven of the fifteen live stores have coordinates. A search can therefore
 * return eight shops and nothing to put a pin on, and the honest behaviour then
 * is for this link to not exist: an empty map reached from a confident link is
 * a worse answer than no link. `count` is the number of results that actually
 * carry a lat AND a lng, counted by the page from the rows the query returned,
 * and the component refuses to render at zero rather than trusting its caller.
 *
 * The count is printed. A buyer who searched "طرابلس" and got 8 shops should be
 * told that 5 of them are mappable before they leave the list, not after.
 *
 * The chevron means "drill in", so it is <ChevronNext/> — which points LEFT in
 * Arabic. That is the opposite of the back chevron on the same screen, and both
 * are correct: they resolve from meaning, never from a side of the display.
 */
export function MapResultsLink({
  href,
  label,
  count,
  className = "",
}: {
  href: string;
  label: string;
  /** Results carrying coordinates. Zero renders nothing. */
  count: number;
  className?: string;
}) {
  if (count < 1) return null;

  return (
    <Link
      href={href}
      className={`flex min-h-12 items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary/40 ${className}`}
    >
      <MapPin aria-hidden className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        {label}{" "}
        <span className="font-medium tabular-nums text-muted-foreground">
          ({count})
        </span>
      </span>
      <ChevronNext
        aria-hidden
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
