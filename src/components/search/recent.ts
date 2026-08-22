// The customer's own search history, and the one place that says where it lives.
//
// Two surfaces write it — the header's phone overlay (mobile-search.tsx) and the
// field on the search screen itself — and the search screen reads it. While
// those carried separate copies of the key, a term typed in the header was
// invisible on the screen it navigated to, which reads as history that forgets
// at random.
//
// It is localStorage and not a table on purpose. `search_logs` is what the
// MARKETPLACE learns from a search; this is what the CUSTOMER remembers of
// their own. It never leaves the device and clearing it is one tap.
//
// Everything here is exposed as an external store rather than as state, because
// that is what it is: React does not own localStorage, cannot render it on the
// server, and must not be told about it from inside an effect.

export const RECENT_KEY = "matjar-recent-searches";

/** Short. This is a shortcut back to what you were just looking at, not an
 *  archive, and on a phone a seventh row is below the fold anyway. */
export const RECENT_MAX = 6;

/** One frozen empty array, reused. useSyncExternalStore compares snapshots by
 *  identity — a fresh `[]` per call is an infinite render loop. */
const EMPTY: string[] = [];

let lastRaw: string | null = null;
let lastValue: string[] = EMPTY;

function rawItem(): string | null {
  try {
    return localStorage.getItem(RECENT_KEY);
  } catch {
    // Private mode denies storage. A search that works is worth more than a
    // history that does.
    return null;
  }
}

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const terms = data
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .slice(0, RECENT_MAX);
    return terms.length ? terms : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * The current history, memoised on the stored text.
 *
 * Re-read on every call rather than cached behind a subscription, so a write
 * made by the header overlay — which navigates here and never announces
 * anything — is picked up by the render that navigation causes. Identity is
 * still stable while the text is unchanged, which is the contract
 * useSyncExternalStore actually requires.
 */
export function recentSnapshot(): string[] {
  const raw = rawItem();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastValue = parse(raw);
  }
  return lastValue;
}

/** There is no history on a server, and pretending otherwise is a hydration
 *  mismatch. */
export function recentServerSnapshot(): string[] {
  return EMPTY;
}

const listeners = new Set<() => void>();

export function subscribeRecent(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab clearing its history should not leave this one showing it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === RECENT_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function announce(): void {
  for (const l of listeners) l();
}

/** Most recent first, no duplicates, capped. */
export function rememberRecent(term: string): void {
  const t = term.trim();
  if (!t) return;
  const next = [t, ...recentSnapshot().filter((r) => r !== t)].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — searching still works, it just is not remembered */
  }
  announce();
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* nothing to clear */
  }
  announce();
}

/**
 * The one spelling of a search address.
 *
 * Arabic is the language this marketplace is searched in, and an un-encoded
 * Arabic term in a query string is how a working search comes back empty and
 * gets reported as an outage. URLSearchParams, everywhere, no exceptions.
 */
export function searchHref(lang: string, term: string): string {
  return `/${lang}/search?${new URLSearchParams({ q: term.trim() }).toString()}`;
}
