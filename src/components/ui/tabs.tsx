"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

// The one tab switcher. Accessible (role=tablist/tab, roving tabindex,
// Arrow/Home/End keys) and RTL-aware: arrow keys follow the visual direction
// of the tablist, so ArrowLeft always moves toward the left on screen.
//
// WHAT THIS IS NOT FOR — it says "replaces the ad-hoc segmented-control button
// rows on dashboards and filters", and an adoption pass found that claim to be
// wrong about most of them. Two things disqualify a caller:
//
//  * A row that FILTERS ONE LIST is not a tablist. The admin status rails
//    (market/moderation/questions), my-listings, the activity rail and the
//    discovery chips all narrow a single list — usually with an "all" option,
//    the tell. There is one region of content, not a set of panels, so
//    `role="tab"` promises a panel switch that never happens. Those want
//    toggle buttons with `aria-pressed`, which is what most already use.
//  * A row of LINKS is not a tablist either. A tab switches a panel inside the
//    current document; /favorites?tab=, the crafts area/sort rails and the
//    discovery group chips navigate. Those want `<nav>` + `aria-current`.
//
// Two gaps to close before pushing adoption on what is left:
//  1. There is no tabpanel contract — no `aria-controls`, and nothing makes a
//     caller mark the switched region `role="tabpanel"`. A tablist wired to
//     nothing is a worse lie than an unlabelled button row.
//  2. The chrome is hardcoded (the pill, `h-9`, `px-3.5`); only the container
//     takes a className, so every migration is also a restyle.

export type TabItem = { key: string; label: ReactNode };

export function Tabs({
  items,
  active,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: {
  items: TabItem[];
  /** Key of the active tab (controlled). */
  active: string;
  onChange: (key: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function activate(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.key);
    refs.current[index]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1 ${className}`}
    >
      {items.map((item, i) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => {
              const rtl =
                getComputedStyle(e.currentTarget).direction === "rtl";
              // "next" = visually toward the end of the list.
              const next = (i + 1) % items.length;
              const prev = (i - 1 + items.length) % items.length;
              if (e.key === "ArrowRight") {
                e.preventDefault();
                activate(rtl ? prev : next);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                activate(rtl ? next : prev);
              } else if (e.key === "Home") {
                e.preventDefault();
                activate(0);
              } else if (e.key === "End") {
                e.preventDefault();
                activate(items.length - 1);
              }
            }}
            // h-9 is 36px — under the 44px this app holds to. The visible pill
            // stays 36px (shrinking the row is the point of a segmented
            // control); the TARGET is grown to 44 by the transparent
            // `::before`, 4px on every side, which is the same trick the rest
            // of the app uses. Measure this with the pseudo-element's insets,
            // never with the button's own box.
            className={`relative h-9 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-150 before:absolute before:-inset-1 before:content-[''] ${
              selected
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
