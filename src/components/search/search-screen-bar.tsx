"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ChevronPrev } from "@/components/ui/directional-icon";
import { rememberRecent, searchHref } from "./recent";

/**
 * The top bar of the phone search screen: a way out, and the field.
 *
 * This is the bar an app has and a web results page does not. Two things about
 * it are load-bearing.
 *
 * THE CHEVRON. It means "back", and back in Arabic points RIGHT. It is spelled
 * <ChevronPrev/> rather than a lucide icon chosen by eye, because picking the
 * arrow by which side of the screen it sits on is precisely the defect that was
 * corrected in 59 places across this repo, and a bare <ChevronLeft/> here would
 * put the 60th back. ChevronPrev resolves the direction from the document's
 * computed `dir` in CSS, so it is right on the server, right after hydration,
 * and right inside any subtree that flips direction.
 *
 * THE HEIGHT. The row is h-12 and the input fills it (h-full). An input left to
 * size itself is a ~23px strip inside a 48px box: the thumb lands on padding,
 * nothing focuses, the keyboard never comes up, and the box measuring 48px in
 * DevTools says nothing about that. The chevron is a 44x44 square outright.
 */
export function SearchScreenBar({
  lang,
  initial,
  labels,
  className = "",
}: {
  lang: string;
  /** The committed term from the URL — the empty string on the search screen
   *  proper, which is also what decides whether the keyboard comes up. */
  initial: string;
  labels: {
    placeholder: string;
    back: string;
    clear: string;
    submit: string;
  };
  className?: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // The URL owns the term. Arriving on a shared link, or pressing Back, has to
  // put the words that produced what is on screen back into the box.
  const committed = useRef(initial);
  useEffect(() => {
    if (initial !== committed.current) {
      committed.current = initial;
      setTerm(initial);
    }
  }, [initial]);

  function submit(next: string) {
    const t = next.trim();
    if (!t) {
      inputRef.current?.focus();
      return;
    }
    committed.current = t;
    rememberRecent(t);
    router.push(searchHref(lang, t));
  }

  function back() {
    // A search screen is nearly always something you arrived at from somewhere,
    // and the chevron should return you there rather than to a fixed page. The
    // one case it cannot — a shared /search link opened cold, where there is no
    // entry to go back to — falls through to the marketplace itself instead of
    // doing nothing under the thumb.
    if (window.history.length > 1) router.back();
    else router.push(`/${lang}`);
  }

  return (
    <div
      className={`border-b border-border bg-background px-3 py-2 ${className}`}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(term);
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={back}
          aria-label={labels.back}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-muted active:bg-surface-muted"
        >
          <ChevronPrev aria-hidden className="h-6 w-6" />
        </button>

        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-surface px-3 focus-within:border-primary">
          <Search
            aria-hidden
            className="h-5 w-5 shrink-0 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            // Only on the screen with nothing to read yet. On a page of results
            // an auto-focus raises the keyboard over the answer just asked for.
            autoFocus={initial === ""}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                inputRef.current?.focus();
              }}
              aria-label={labels.clear}
              // The visible glyph is 32px; the transparent ::before grows the
              // hit area past 44 without moving the layout around it.
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Present for the form to have a submit control at all — the keyboard's
            own search key is what a phone actually uses, and a second button
            beside a 12px-margin field would crowd the row at 320px. */}
        <button type="submit" className="sr-only">
          {labels.submit}
        </button>
      </form>
    </div>
  );
}
