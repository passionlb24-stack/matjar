// Debounced-search state, derived rather than stored.
//
// The explore page used to keep `productResults` and `searching` as two separate
// flags that an effect raised and lowered. Any response that arrived for a query
// the user had already moved past would lower the flag anyway — the spinner
// stopped while the results on screen belonged to a different word.
//
// Storing the answer WITH the term it answers removes the possibility: "still
// searching" is simply "the answer I hold is not for the term I have".

export type SearchAnswer<T> = {
  /** The term this answer was fetched for. */
  term: string;
  /** null = the lookup failed; [] = it succeeded and found nothing. */
  hits: T[] | null;
};

export type SearchState<T> = {
  /** The trimmed query. */
  term: string;
  /** Whether the term is long enough for the lookup to run at all. */
  active: boolean;
  /** Hits for the CURRENT term, or null while they don't exist yet. */
  results: T[] | null;
  /** True while the held answer doesn't match the current term. */
  searching: boolean;
};

/**
 * @param rawQuery what the user typed, untrimmed
 * @param answer   the most recent answer received, or null
 * @param minChars shortest term worth a lookup (matches the RPC's own guard)
 */
export function resolveSearch<T>(
  rawQuery: string,
  answer: SearchAnswer<T> | null,
  minChars = 2,
): SearchState<T> {
  const term = rawQuery.trim();
  const active = term.length >= minChars;
  return {
    term,
    active,
    results: active && answer?.term === term ? answer.hits : null,
    searching: active && answer?.term !== term,
  };
}
