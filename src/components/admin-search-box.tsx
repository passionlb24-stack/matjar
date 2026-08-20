"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/field";

// ISS-014 — one search box for the admin pages that stayed server components.
//
// The four queues this serves (audit, leaders, reviews, orders) render their
// rows on the server and have no client shell to hold state in. Converting each
// into a client component to gain a text filter would move hundreds of lines of
// markup across the boundary for one input, so the query lives in the URL
// instead: this island writes `?q=`, the server page reads it and filters the
// rows it already fetched.
//
// Three things fall out of that choice, and all three are wanted:
//   - a searched view is a link. "the audit rows for this store" is now
//     something an admin can paste to another admin.
//   - back/forward work, because each search is a history-replacing navigation
//     and the browser keeps the input in sync via `searchParams`.
//   - there is exactly one filtering implementation (filterByQuery), running
//     server-side, rather than one per page.
//
// The cost is a round trip per settled keystroke, which is why the write is
// debounced and uses `replace` rather than `push` — otherwise a ten-character
// query leaves ten entries in the history stack for Back to walk through.

/** Long enough that ordinary typing produces one navigation, short enough that
 *  the list feels like it is responding to you. */
const DEBOUNCE_MS = 250;

export function AdminSearchBox({
  placeholder,
  clearLabel,
  /** Rendered under the box when a query is active — the caller's chance to say
   *  "3 of the most recent 300", which is the difference between "nothing
   *  matched" and "nothing matched in the part you can see". */
  hint,
}: {
  placeholder: string;
  clearLabel: string;
  hint?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);

  // The URL is the source of truth, but only when it changes underneath us —
  // Back, a pasted link, a Clear press. Syncing on every render would fight the
  // user's own typing during the debounce window.
  const lastPushed = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  useEffect(() => {
    if (value === urlQuery) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set("q", value);
      else next.delete("q");
      lastPushed.current = value.trim() ? value : "";
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, urlQuery, pathname, router, searchParams]);

  return (
    <div className="mb-6">
      <div className="relative sm:max-w-md">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          // Deliberately not type="search": WebKit and Chrome draw their own
          // clear affordance for it, which would sit next to ours and clear the
          // input without going through setValue.
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="ps-10 pe-10"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label={clearLabel}
            // The icon is 16px; the pseudo-element is what a thumb actually
            // hits. Measuring the button's own box would report ~24px and pass
            // nothing that matters.
            className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
