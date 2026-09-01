/**
 * The freelance search box.
 *
 * A plain GET form, and a server component: no `use client`, no state, no
 * debounce, no fetch. `browse_gigs` already takes `p_q` and matches it against
 * the title, the description AND the person's name (0215/0294), so the search
 * that matters is a server round trip either way — and doing it with a real
 * form means it works before hydration, restores from the URL for free, and is
 * shareable and back-button-correct.
 *
 * Every other active filter rides along as a hidden input. Without that,
 * searching inside a category silently drops the category, which is the classic
 * way a filtered marketplace loses a shopper's place.
 */

import { Search } from "lucide-react";

import type { Dictionary } from "@/i18n/get-dictionary";
import { fieldClass } from "@/components/ui/field";

export function FreelanceSearch({
  action,
  q,
  hidden,
  dict,
}: {
  /** Form target, e.g. `/ar/freelance`. */
  action: string;
  q?: string;
  /** Filters to preserve across the search, as name → value. */
  hidden: Record<string, string | undefined>;
  dict: Pick<Dictionary, "freelance">;
}) {
  const t = dict.freelance.people;

  return (
    <form action={action} method="get" role="search" className="flex gap-2">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <label htmlFor="freelance-q" className="sr-only">
        {t.searchLabel}
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="freelance-q"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.searchPlaceholder}
          maxLength={80}
          className={`${fieldClass} ps-10`}
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {t.search}
      </button>
    </form>
  );
}
