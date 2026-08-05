// Send a client component only the part of the dictionary it reads.
//
// Every prop crossing a server → client boundary is serialised into the page,
// once per boundary. The home page passed the whole Dictionary to three client
// components, so a ~175KB translation file shipped three times over: 212KB of
// inline script, 62% of the document, and the reason the page sat on its
// loading skeleton on a phone while every other page came up.
//
// Narrowing the TYPE is not enough — TypeScript has no effect on what gets
// serialised. The object handed across the boundary has to actually be smaller,
// which is what this builds.

import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * A new object carrying only `keys`, typed as the matching Pick so the
 * component keeps full type safety on what it is allowed to read.
 *
 * @example dictSlice(dict, ["home", "catalog"])   // ~2KB instead of ~175KB
 */
export function dictSlice<K extends keyof Dictionary>(
  dict: Dictionary,
  keys: readonly K[],
): Pick<Dictionary, K> {
  const out = {} as Pick<Dictionary, K>;
  for (const k of keys) out[k] = dict[k];
  return out;
}
