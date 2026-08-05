"use client";

// Jump to any admin section by typing. Ctrl/⌘ + K, or the button in the nav.
//
// Twenty-three sections is past the point where a strip of tabs works: finding
// one meant scrolling sideways and reading every label on the way. The strip is
// still there for the sections someone uses daily; this is for the other twenty.
//
// The trigger is a visible button, not only a shortcut. A keyboard-only palette
// is invisible to the person who most needs it — the one who does not already
// know the sections by heart.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { filterSections, type SearchableSection } from "@/lib/admin-search";

export function AdminCommandPalette({
  sections,
  label,
  placeholder,
  empty,
}: {
  sections: SearchableSection[];
  label: string;
  placeholder: string;
  empty: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = filterSections(sections, q);

  // Opening resets the query. Done here rather than in an effect keyed on
  // `open`: both entry points are already callbacks, and clearing state from an
  // effect costs an extra render where the palette shows the previous search.
  function openPalette() {
    setQ("");
    setActive(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setQ("");
            setActive(0);
          }
          return !v;
        });
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus is a DOM effect, not state — this is what effects are for.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        {label}
        <kbd className="hidden rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder={placeholder}
                className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-muted-foreground"
                aria-label={placeholder}
              />
            </div>

            {results.length ? (
              <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
                {results.map((s, i) => (
                  <li key={s.key} data-idx={i}>
                    <button
                      type="button"
                      onClick={() => go(s.href)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                        i === active ? "bg-primary-soft" : "hover:bg-surface-muted"
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-sm font-bold ${
                            i === active ? "text-primary" : ""
                          }`}
                        >
                          {s.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {s.group}
                        </span>
                      </span>
                      {i === active && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {empty}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
