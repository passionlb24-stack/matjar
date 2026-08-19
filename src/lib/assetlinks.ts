// Parsing for the Android Digital Asset Links fingerprint (MP-030).
//
// Kept out of the route file so it can be unit-tested: this is the one piece of
// App Links setup a non-technical person types by hand, and a fingerprint that
// is wrong by one character fails silently — Android just never verifies and
// links keep opening the browser, with no error anywhere.

/** From `android/app/build.gradle` (applicationId / namespace). */
export const ANDROID_PACKAGE_NAME = "com.matjarlb.app";

/** Canonical keytool form: 32 uppercase hex pairs joined by colons. */
const FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

/**
 * Accept what a human actually has on their clipboard. The Play Console and
 * `keytool` both print colon-separated pairs, sometimes lowercase, sometimes
 * with stray whitespace or a line break pasted in; some tools print 64 bare hex
 * characters. Normalise all of those to the canonical form, reject the rest.
 */
function normaliseFingerprint(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return null;
  const withColons = /^[0-9A-F]{64}$/.test(cleaned)
    ? (cleaned.match(/.{2}/g) ?? []).join(":")
    : cleaned;
  return FINGERPRINT.test(withColons) ? withColons : null;
}

export type ParsedFingerprints = {
  /** Valid, de-duplicated, canonical fingerprints. */
  fingerprints: string[];
  /** Entries that were present but unusable — the reason to fail loudly. */
  invalid: string[];
};

/**
 * Parse the `ANDROID_APP_CERT_SHA256` env var: one fingerprint, or several
 * separated by commas (a Play-signed release and a locally-signed build need
 * one each, and both must be listed for both to open links).
 */
export function parseFingerprints(raw: string | undefined): ParsedFingerprints {
  const parts = (raw ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const fingerprints: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const ok = normaliseFingerprint(part);
    if (ok) fingerprints.push(ok);
    else invalid.push(part);
  }
  return { fingerprints: [...new Set(fingerprints)], invalid };
}

/** The document Android expects, given at least one valid fingerprint. */
export function assetLinksDocument(fingerprints: string[]) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
