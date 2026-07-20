"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

// The one tab switcher. Replaces the ad-hoc segmented-control button rows on
// dashboards and filters. Accessible (role=tablist/tab, roving tabindex,
// Arrow/Home/End keys) and RTL-aware: arrow keys follow the visual direction
// of the tablist, so ArrowLeft always moves toward the left on screen.

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
            className={`h-9 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-150 ${
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
