// Matching a typed query against admin section names.
//
// Twenty-three sections is past the point where scanning a strip works, so the
// fast path becomes typing. That only helps if the matching forgives how Arabic
// is actually typed — a merchant manager reaching for "الاشتراكات" should not
// have to remember whether the label carries a hamza.
//
// Mirrors normalize_search() in migration 0216 so the two never disagree about
// what counts as the same word.

export function normalizeLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export type SearchableSection = {
  key: string;
  /** Shown in the list. */
  label: string;
  /** The group heading, matched too — typing "سوق" should find its members. */
  group: string;
  href: string;
};

/**
 * Substring match over the label, the group and the raw key. Not fuzzy on
 * purpose: with 23 items a fuzzy matcher mostly produces confident wrong
 * answers, and the top hit is the one Enter selects.
 *
 * An empty query returns everything, so opening the palette shows the full map
 * rather than a blank box.
 */
export function filterSections<T extends SearchableSection>(
  sections: T[],
  query: string,
): T[] {
  const q = normalizeLabel(query);
  if (!q) return sections;
  return sections.filter((s) => {
    const hay = `${normalizeLabel(s.label)} ${normalizeLabel(s.group)} ${s.key.toLowerCase()}`;
    // Every word must appear somewhere: "طلبات سوق" narrows instead of widening.
    return q.split(" ").every((word) => hay.includes(word));
  });
}

// ---------------------------------------------------------------------------
// The same matching, pointed at rows instead of at the nav.
//
// ISS-014. The admin queues that grow — the audit log, the leader roster, the
// review pile, the order ledger — had no way to find a record in them. The
// matching rule should not be a second one: an admin who types "الاعدادات" in
// the palette and "احمد" in the leaders box is doing the same thing, and both
// should forgive the hamza the same way. So these reuse normalizeLabel rather
// than reaching for `.toLowerCase().includes()` — which is what the store and
// moderation filters do today, and which quietly fails on "أحمد" vs "احمد".
//
// Why not push this into SQL. normalize_search() exists in the database (0216)
// but only as a function, with no normalized column and no RPC for these
// tables; using it would mean a migration per surface. An `.ilike()` needs no
// migration but cannot fold the hamza, which is the whole point in Arabic. So
// the match runs in JS over the rows the page already fetched — and every page
// that does this says out loud how many rows that window holds, because
// "no results" and "no results in the most recent 300" are different answers
// and an admin cannot tell them apart otherwise.

/** True when every whitespace-separated word in `query` appears somewhere in
 *  `fields`. Nullish fields are skipped, so callers can pass optional columns
 *  straight through. An empty query matches everything. */
export function matchesQuery(
  query: string,
  fields: readonly (string | null | undefined)[],
): boolean {
  const q = normalizeLabel(query);
  if (!q) return true;
  const hay = fields
    .filter((f): f is string => !!f)
    .map(normalizeLabel)
    .join(" ");
  return q.split(" ").every((word) => hay.includes(word));
}

/**
 * Filter rows by a query, given a function that names the searchable fields of
 * one row. Returns the input array unchanged when the query is empty, so the
 * unsearched case costs nothing.
 */
export function filterByQuery<T>(
  rows: readonly T[],
  query: string,
  fieldsOf: (row: T) => readonly (string | null | undefined)[],
): T[] {
  if (!normalizeLabel(query)) return rows as T[];
  return rows.filter((row) => matchesQuery(query, fieldsOf(row)));
}
