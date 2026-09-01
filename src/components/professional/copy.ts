// The dictionary slice every component in this folder reads, plus the two
// string helpers they share.
//
// Typed as a `Pick` rather than the whole `Dictionary` on purpose: a caller can
// pass the full dictionary (it is assignable) OR a `dictSlice(dict,
// ["professional"])`, which is what a client boundary needs — see
// src/lib/dict-slice.ts for why handing a client component the whole 175KB
// dictionary is a real bug and not a style note.

import type { Dictionary } from "@/i18n/get-dictionary";

export type ProfessionalDict = Pick<Dictionary, "professional">;

/**
 * Interpolate `{name}` placeholders, falling back when a key is missing.
 *
 * Same shape as the helper in components/trust-chips.tsx: a dictionary briefly
 * out of step with the code should cost a word, not the page.
 */
export function fill(
  template: string | undefined,
  fallback: string,
  vars: Record<string, string | number> = {},
): string {
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replace(`{${k}}`, String(v)),
    template ?? fallback,
  );
}

// ===== Counted phrases =====
//
// Arabic does not have one plural, it has four, and the number governs the
// noun: سنة (1), سنتين (2), 3 سنوات (3–10), 11 سنة (11+). A single template
// with a digit dropped into it — "{count} سنة" — is therefore wrong for every
// value except 1 and 11+, and it is wrong in the specific way that reads as
// machine translation to the audience this app is built for: "1 تقييم",
// "2 تقييم".
//
// The forms are CLDR's for Arabic, keyed off the last two digits, so 103 takes
// the same form as 3. `zero` is deliberately not modelled: nothing in this
// folder ever renders a counted phrase for 0 — a count of zero renders nothing
// at all, which is the rule the whole folder is built on.
//
// English fills all four keys with its two real forms, so both dictionaries
// keep an identical shape and `Dictionary` stays a clean union.

export type PluralKey = "one" | "two" | "few" | "many";

export function pluralKey(n: number): PluralKey {
  if (n === 1) return "one";
  if (n === 2) return "two";
  const mod = Math.abs(n) % 100;
  if (mod >= 3 && mod <= 10) return "few";
  return "many";
}

/**
 * A counted phrase from a `{one,two,few,many}` group, with `{count}` filled in.
 *
 * The one/two forms carry no digit on purpose in Arabic — you write "سنتين",
 * not "2 سنتين".
 */
export function plural(group: unknown, n: number, fallback: string): string {
  const map = group as Record<string, unknown> | undefined;
  const form = map?.[pluralKey(n)];
  return fill(typeof form === "string" ? form : undefined, fallback, {
    count: n,
  });
}

/** Read a dynamic key out of a dictionary map (completeness step keys). */
export function lookup(map: unknown, key: string): string | undefined {
  const value = (map as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" ? value : undefined;
}

/** List separator. Arabic uses the Arabic comma; English the Latin one. */
export function listSep(lang: "ar" | "en"): string {
  return lang === "ar" ? "، " : ", ";
}
