"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Clock, X } from "lucide-react";

const KEY = "matjar-recent-searches";
const MAX = 6;

// Search as a screen, not a field.
//
// A 210px input inside a 375px header is a control the on-screen keyboard
// covers the moment it is tapped, with nowhere to show what was searched
// before. Every marketplace app gives search its own surface; this is that
// surface, and it stays a phone-only path — desktop keeps the sticky header
// field, where a wide input works fine.
//
// It deliberately does not re-implement search: submitting goes to the existing
// /search route. What it adds is the part a header field cannot have — room for
// the keyboard, targets a thumb can hit, and the customer's own history.
export function MobileSearch({
  lang,
  labels,
}: {
  lang: string;
  labels: {
    open: string;
    placeholder: string;
    recent: string;
    clear: string;
    back: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    try {
      setRecent(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      setRecent([]);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The keyboard should be up before the user decides to think.
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function go(term: string) {
    const t = term.trim();
    if (!t) return;
    try {
      const next = [t, ...recent.filter((r) => r !== t)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode — searching still works, it just isn't remembered */
    }
    setOpen(false);
    setQ("");
    router.push(`/${lang}/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 text-sm text-muted-foreground lg:hidden"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">{labels.placeholder}</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={labels.open}
            className="fixed inset-0 z-[110] flex flex-col bg-background lg:hidden"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(q);
              }}
              className="flex items-center gap-2 border-b border-border px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.back}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </button>

              <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-primary">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={labels.placeholder}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      inputRef.current?.focus();
                    }}
                    aria-label={labels.clear}
                    className="shrink-0 text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {recent.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-label text-muted-foreground">
                      {labels.recent}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem(KEY);
                        } catch {
                          /* nothing to clear */
                        }
                        setRecent([]);
                      }}
                      className="h-11 px-2 text-sm font-semibold text-muted-foreground underline"
                    >
                      {labels.clear}
                    </button>
                  </div>
                  <ul className="mt-1">
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => go(r)}
                          className="flex h-12 w-full items-center gap-3 text-start text-sm"
                        >
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{r}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
