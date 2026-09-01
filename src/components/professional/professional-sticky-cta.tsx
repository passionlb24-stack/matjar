"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronUp, MessageCircle } from "lucide-react";

// The mobile action bar, kept under the thumb.
//
// ===== The geometry, and the bug it exists not to repeat =====
//
// The app has a fixed bottom tab bar (`bottom-nav`, z-50) whose visible row is
// `--m-tabbar-h` and which adds `env(safe-area-inset-bottom)` BELOW that row for
// the home indicator. A bar that sits at `bottom-0` therefore lands *underneath*
// the tabs — which is exactly what happened to a checkout button that spent a
// release 41px under the tab bar, tappable only in the sliver that stuck out.
//
// So, matching the three bars already in this repo (order-sticky-actions,
// product-buy-bar, store/store-sticky-cta):
//
//   bottom-[var(--m-tabbar-h)]        sit on top of the tab row
//   pb-[env(safe-area-inset-bottom)]  keep our own content off the indicator
//   z-40                              under the tab bar's z-50, never over it
//   lg:hidden                         there is no tab bar on desktop
//
// Do not "simplify" any of those four. Each one is load-bearing and three of
// them are invisible until a real phone is in a hand.
//
// The label and note are plain strings, not a dictionary slice: this is the one
// component here that crosses the server → client boundary, and handing a client
// component the dictionary is a 175KB serialisation per boundary (see
// src/lib/dict-slice.ts).

export function ProfessionalStickyCta({
  label,
  href,
  targetId,
  note,
}: {
  label: string;
  /**
   * Where the action goes. An in-app route, or `tel:` / `wa.me` for an outbound
   * one — outbound links get the new-context hardening.
   */
  href?: string;
  /** Scroll to this section instead, and hide once it is on screen. */
  targetId?: string;
  /** A true one-line fact — "from $30". Never a promise, never a countdown. */
  note?: string | null;
}) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    // The bar must never cover the control it points at.
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [targetId]);

  if (!show) return null;

  const outbound = Boolean(href && /^(tel:|mailto:|https?:)/.test(href));
  const classes =
    "inline-flex h-[var(--m-touch)] shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold whitespace-nowrap text-primary-foreground shadow-sm transition-transform active:scale-[0.97]";

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

        {outbound ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        ) : href ? (
          <Link href={href} className={classes}>
            {label}
          </Link>
        ) : (
          <a
            href={`#${targetId ?? ""}`}
            onClick={(e) => {
              if (!targetId) return;
              const el = document.getElementById(targetId);
              if (!el) return;
              // Smooth-scroll where we can, but keep the href so the bar still
              // works before hydration and reads as a link.
              e.preventDefault();
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={classes}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        )}
      </div>
    </div>
  );
}
