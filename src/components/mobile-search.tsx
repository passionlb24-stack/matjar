"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

// The header's way into search, on a phone.
//
// This used to BE the search screen: a portal overlay with its own input, its
// own copy of the recent-searches key, and its own idea of what search looks
// like. /search is now that screen — it has the field, the customer's own
// history, the sector shortcuts, results grouped by kind and a way onto the
// map — so the overlay was a second, worse implementation of a screen that
// already exists, shipping ~2KB of client JS to every public page to duplicate
// it. What the header needs is a door, and a door is a link.
//
// It hides itself ON the search route. The screen there opens with its own bar
// — a back chevron and the field it owns — and a header field stacked above
// that bar would be two search boxes in the first 120px of a phone viewport,
// with only one of them attached to what is on screen. `usePathname` is the
// only reason this is still a client component; the alternative was for the
// header (another agent's file) to know which route it is on.
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
  const pathname = usePathname();
  // Matches /ar/search and /ar/search/anything, not /ar/searchable-thing.
  const onSearchScreen =
    pathname === `/${lang}/search` || pathname.startsWith(`/${lang}/search/`);
  if (onSearchScreen) return null;

  return (
    <Link
      href={`/${lang}/search`}
      aria-label={labels.open}
      className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 text-sm text-muted-foreground lg:hidden"
    >
      <Search aria-hidden className="h-4 w-4 shrink-0" />
      <span className="truncate">{labels.placeholder}</span>
    </Link>
  );
}
