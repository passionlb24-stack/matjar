"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import {
  clearRecent,
  recentServerSnapshot,
  recentSnapshot,
  searchHref,
  subscribeRecent,
} from "./recent";

/**
 * What this customer searched for before.
 *
 * This is the only "suggestions" block on the screen, and it is deliberately
 * the only one. The obvious sibling — trending or popular searches — would have
 * to come from `search_logs`, which holds two rows from a single minute of one
 * day. Three terms invented to fill the space would be a shop window with
 * painted-on goods; the honest screen shows the buyer's own history and the
 * sectors that really have stores, and nothing else.
 *
 * localStorage is not React state and is not readable on the server, so it is
 * subscribed to as the external store it is. The block appears a frame after
 * hydration rather than mismatching it, and a first-time visitor gets nothing
 * at all — no heading, no empty box, no explanation of a feature they have not
 * used yet.
 */
export function RecentSearches({
  lang,
  labels,
  titleId,
  className = "",
}: {
  lang: string;
  labels: { title: string; clear: string };
  titleId: string;
  className?: string;
}) {
  const terms = useSyncExternalStore(
    subscribeRecent,
    recentSnapshot,
    recentServerSnapshot,
  );

  if (terms.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-extrabold">
          {labels.title}
        </h2>
        <button
          type="button"
          onClick={clearRecent}
          className="relative flex h-11 items-center px-2 text-sm font-semibold text-muted-foreground underline before:absolute before:-inset-x-2 before:content-[''] hover:text-foreground"
        >
          {labels.clear}
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {terms.map((t) => (
          <li key={t}>
            <Link
              href={searchHref(lang, t)}
              className="inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-primary/40"
            >
              <Clock aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
