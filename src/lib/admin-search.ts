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
