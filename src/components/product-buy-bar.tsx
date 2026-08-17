"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

// The price and the action, pinned while the buy box is off screen.
//
// A phone-sized product page is mostly reviews, similar items and photos; two
// flicks of the thumb and the one control the page exists for is gone. This bar
// appears exactly then — an IntersectionObserver watches the real buy box and
// the bar only exists while it is out of view, so nothing is duplicated on
// screen and nothing covers content while the customer is already looking at
// the price.
//
// The button scrolls back to the buy box instead of cloning its logic: variants,
// quantity and stock rules live in one place, and a second submit path is how
// they drift apart.
export function ProductBuyBar({
  targetId,
  price,
  compareAt,
  label,
  soldOut,
  soldOutLabel,
}: {
  targetId: string;
  price: string;
  compareAt?: string | null;
  label: string;
  soldOut: boolean;
  soldOutLabel: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    // No "has it been seen first" guard: a deep link or a fast flick jumps
    // PAST the box without ever intersecting it, and that reader is exactly
    // the one who needs the bar. It simply mirrors "the buy box is not on
    // screen" — including on first paint, where a visible price is a feature.
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [targetId]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-[var(--m-tabbar-h)] z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-[var(--m-sticky-gap)] px-[var(--m-page-x)] py-2.5">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-primary tabular-nums" dir="ltr">
            {price}
          </p>
          {compareAt && (
            <p className="text-xs text-muted-foreground line-through tabular-nums" dir="ltr">
              {compareAt}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={soldOut}
          onClick={() =>
            document
              .getElementById(targetId)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          className="relative inline-flex h-[var(--m-touch)] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold whitespace-nowrap text-primary-foreground shadow-sm transition-[transform,box-shadow,background-color] duration-150 select-none hover:bg-primary-hover hover:shadow-md active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55"
        >
          <ChevronUp className="h-4 w-4" />
          {soldOut ? soldOutLabel : label}
        </button>
      </div>
    </div>
  );
}
