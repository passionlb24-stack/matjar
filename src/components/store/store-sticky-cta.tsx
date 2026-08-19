"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

// The store's primary action, kept under the thumb.
//
// A storefront on a phone opens on identity — cover, name, badges, hours — and
// the thing the customer came to do (order, book) is a section further down. The
// action follows them until they reach it.
//
// It renders on the server (so it is in the first paint and works before
// hydration) and an IntersectionObserver hides it once the real engine is on
// screen — the bar never covers the control it points at, and it never clones
// that control's logic: it scrolls to it. Cart rules, variants, slot allocation
// and provider matching stay in exactly one place.
//
// Geometry matches the other two sticky bars on this app (order-sticky-actions,
// product-buy-bar): it sits on top of the tab bar's own height and adds the home
// indicator inset, so it can never cover a tab or be trapped under one.
export function StoreStickyCta({
  targetId,
  label,
  note,
}: {
  targetId: string;
  label: string;
  /** A true one-line fact — the store name, "starts from $x". Never a promise. */
  note?: string | null;
}) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [targetId]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-[var(--m-tabbar-h)] z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-[var(--m-sticky-gap)] px-[var(--m-page-x)] py-2.5">
        {note ? (
          <p className="min-w-0 truncate text-sm font-semibold text-muted-foreground">
            {note}
          </p>
        ) : (
          <span />
        )}
        <a
          href={`#${targetId}`}
          onClick={(e) => {
            // Smooth-scroll where the browser supports it, but keep the href so
            // the bar still works with JS off and reads as a link.
            const el = document.getElementById(targetId);
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="inline-flex h-[var(--m-touch)] shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold whitespace-nowrap text-primary-foreground shadow-sm transition-transform active:scale-[0.97]"
        >
          <ChevronUp className="h-4 w-4" />
          {label}
        </a>
      </div>
    </div>
  );
}
