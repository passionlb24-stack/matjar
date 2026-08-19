"use client";

import { useEffect, useRef, useState } from "react";

export type StoreSectionTab = {
  /** ProfileSectionKey — the anchor is `sec-${key}`. */
  key: string;
  label: string;
};

// The store profile's own tab rail, for phones only.
//
// A storefront on a phone is a single column that can run past ten screens: the
// menu, the week's hours, the map, the credentials, the reviews. Everything the
// sector registry decided to put first is reachable; everything it put fifth is
// a scroll the customer never makes.
//
// The tabs are NOT a list written here. The page derives them from
// resolveProfileOrder() filtered by which sections actually rendered something,
// so the rail is in the sector's own order and a section with no data produces
// no tab — a chip that scrolls to nothing is worse than no chip.
//
// Scroll-spy is an IntersectionObserver, never a scroll handler: the active
// chip is set from the observer callback (an event, not an effect body), which
// is also why this does not trip react-hooks/set-state-in-effect.
export function StoreSectionTabs({
  tabs,
  label,
}: {
  tabs: StoreSectionTab[];
  /** aria-label for the rail — it is a navigation landmark, not decoration. */
  label: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // Which sections are currently crossing the band just under the sticky
    // chrome. rootMargin pulls the top edge down past the header + this rail so
    // "active" means "the section you are reading", not "the section hidden
    // behind the header".
    const visible = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = e.target.id.replace(/^sec-/, "");
          if (e.isIntersecting) visible.add(key);
          else visible.delete(key);
        }
        // Page order wins over observer callback order, so scrolling up and
        // scrolling down agree on which chip lights.
        const first = tabs.find((t) => visible.has(t.key));
        if (first) setActive(first.key);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    for (const t of tabs) {
      const el = document.getElementById(`sec-${t.key}`);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [tabs]);

  // Keep the lit chip in view on a 360px rail — otherwise scroll-spy is a
  // feature the customer cannot see.
  useEffect(() => {
    if (!active) return;
    const chip = railRef.current?.querySelector<HTMLElement>(
      `[data-tab="${active}"]`,
    );
    chip?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label={label}
      className="sticky top-[calc(var(--m-header-h)+env(safe-area-inset-top))] z-30 -mx-[var(--m-page-x)] border-b border-border bg-background/95 backdrop-blur-md lg:hidden print:hidden"
    >
      <div
        ref={railRef}
        className="flex h-[var(--m-sectiontabs-h)] items-stretch gap-1 overflow-x-auto px-[var(--m-page-x)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <a
              key={t.key}
              href={`#sec-${t.key}`}
              data-tab={t.key}
              aria-current={on ? "true" : undefined}
              className={`flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-bold transition-colors ${
                on
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
