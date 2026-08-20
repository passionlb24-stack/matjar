// Who legally operates Matjar (ISS-025).
//
// A marketplace that asks a stranger for a phone number and a home address, and
// asks a shop owner to put their livelihood on it, and never says which company
// is behind any of that, is asking for a trust it has not offered to earn. The
// /legal page is the surface that answers it.
//
// The answer itself is a FACT NOBODY IN THIS REPOSITORY KNOWS. The registered
// name, the commercial register number, the registered address — inventing a
// plausible-looking version of any of them would be the single worst thing this
// page could do: it would look finished, satisfy every reviewer, and be a lie
// printed under a heading that says "who we are".
//
// So it follows ANDROID_APP_CERT_SHA256 exactly (src/lib/assetlinks.ts): the
// values live in environment variables, never in the repo; this module is a
// pure parser so it can be unit-tested; and a deployment that has not set them
// fails VISIBLY — a named, unmissable "not configured" panel listing the exact
// variables, a server-side console.error, and a noindex on the page — rather
// than shipping a confident placeholder.
//
// Set these in the hosting environment (Vercel → Settings → Environment
// Variables) and redeploy:
//
//   MATJAR_LEGAL_NAME          Registered name and legal form, exactly as
//                              on the commercial register.
//                              e.g. "Matjar SARL"
//   MATJAR_LEGAL_REGISTRATION  Commercial register number, with the register
//                              it is filed in.
//                              e.g. "Tripoli Commercial Register 12345"
//   MATJAR_LEGAL_ADDRESS       Registered address, one line.
//   MATJAR_LEGAL_EMAIL         The address legal and consumer notices are to
//                              be sent to. Must be a real, monitored mailbox.
//
// And, only if the entity is actually VAT-registered:
//
//   MATJAR_LEGAL_VAT           VAT / TVA number. Omit entirely if there is
//                              none — an empty one is not shown.

/** The variables the page cannot honestly render without. */
export const LEGAL_ENV_KEYS = [
  "MATJAR_LEGAL_NAME",
  "MATJAR_LEGAL_REGISTRATION",
  "MATJAR_LEGAL_ADDRESS",
  "MATJAR_LEGAL_EMAIL",
] as const;

export type LegalEnvKey = (typeof LEGAL_ENV_KEYS)[number];

/** The optional one. Absent is a valid answer; blank is treated as absent. */
export const LEGAL_VAT_KEY = "MATJAR_LEGAL_VAT";

export type LegalEntityState =
  | {
      configured: true;
      fields: Record<LegalEnvKey, string>;
      /** null when the entity is not VAT-registered. */
      vat: string | null;
    }
  | {
      configured: false;
      /** Unset, blank or filled with a filler token — named so the owner knows
       *  which ones to go and set. */
      missing: LegalEnvKey[];
      /** Set to something that cannot be the real value. Listed separately
       *  because "you left it empty" and "you typed TODO in it" are different
       *  mistakes and the second one is the dangerous one. */
      placeholders: LegalEnvKey[];
    };

// The strings a half-finished deployment actually contains. Caught because a
// value like "TODO" would otherwise render as this platform's registered name
// on a public legal page and pass every automated check on the way there.
const FILLER = new Set([
  "todo",
  "tbd",
  "tba",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "-",
  "--",
  "xxx",
  "xxxx",
  "changeme",
  "change_me",
  "placeholder",
  "example",
  "test",
  "your company",
  "company name",
]);

function isFiller(value: string): boolean {
  return FILLER.has(value.toLowerCase().replace(/\s+/g, " ").trim());
}

/**
 * Read the legal-entity configuration out of an environment.
 *
 * Takes the environment as an argument rather than reaching for `process.env`
 * so the whole thing is a pure function with no ambient state — the same reason
 * parseFingerprints() takes its raw string.
 */
export function readLegalEntity(
  env: Record<string, string | undefined>,
): LegalEntityState {
  const missing: LegalEnvKey[] = [];
  const placeholders: LegalEnvKey[] = [];
  const fields = {} as Record<LegalEnvKey, string>;

  for (const key of LEGAL_ENV_KEYS) {
    const value = (env[key] ?? "").trim();
    if (!value) {
      missing.push(key);
      continue;
    }
    // An email that is not an email is a placeholder however it was typed: a
    // consumer notice sent to it would vanish, which is worse than the page
    // admitting it has no address to give.
    const bad =
      isFiller(value) ||
      (key === "MATJAR_LEGAL_EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    if (bad) {
      placeholders.push(key);
      continue;
    }
    fields[key] = value;
  }

  if (missing.length > 0 || placeholders.length > 0) {
    return { configured: false, missing, placeholders };
  }

  const rawVat = (env[LEGAL_VAT_KEY] ?? "").trim();
  return {
    configured: true,
    fields,
    vat: rawVat && !isFiller(rawVat) ? rawVat : null,
  };
}
