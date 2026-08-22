"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { rememberRecent, searchHref } from "./recent";

/**
 * The field the search screen is built around.
 *
 * The header's field is a doorway; this one is the room. It matters that it
 * exists on the RESULTS page too: without it, changing one word of a query
 * means going back, reopening the header overlay and starting again, which is
 * why a customer who mistypes on a phone gives up rather than corrects.
 *
 * It focuses itself only when there is nothing to read yet. On a results page
 * an auto-focus would raise the keyboard over the answer the buyer just asked
 * for.
 */
export function SearchBox({
  lang,
  initial,
  labels,
  className = "",
}: {
  lang: string;
  /** The committed term from the URL. */
  initial: string;
  labels: { placeholder: string; submit: string; clear: string };
  className?: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // The URL is the source of truth. Arriving on a shared link, or pressing
  // Back, has to put the term that produced what is on screen into the box.
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
    // Encoded, always. An Arabic term pasted raw into a query string is the
    // defect that once made a live search look like an outage.
    router.push(searchHref(lang, t));
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(term);
      }}
      className={`flex items-center gap-2 ${className}`}
    >
      <div className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-border bg-surface px-3 focus-within:border-primary">
        <Search aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoFocus={initial === ""}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          // h-full, not the browser's line-height. Left to size itself the
          // input is a 23px strip inside a 48px box: the thumb lands on the
          // padding, nothing focuses, and the keyboard does not come up. The
          // box being tall enough is not the same as the target being tall
          // enough, which is exactly the measurement mistake this repo keeps
          // making in the other direction.
          className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
            aria-label={labels.clear}
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        type="submit"
        className="h-12 shrink-0 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover active:scale-[0.97]"
      >
        {labels.submit}
      </button>
    </form>
  );
}
