// Parsing for the Apple App Site Association identifier — the iOS half of
// MP-030 / B-26. Kept out of the route so it can be unit-tested, for the same
// reason as `assetlinks.ts`: this is a value a non-technical person copies by
// hand from an Apple portal, and a wrong one fails completely silently.

/** From `capacitor.config.ts` (`appId`). Must match the iOS bundle identifier. */
export const IOS_BUNDLE_ID = "com.matjarlb.app";

/**
 * An App ID is `<TeamID>.<BundleID>`. The Team ID is exactly 10 alphanumeric
 * characters, issued by Apple and visible in the Developer portal's Membership
 * page. The bundle id is reverse-DNS.
 *
 * Deliberately strict about the Team ID's shape: it is the only half a human
 * types, and "looks about right" is how a domain ends up serving a document
 * that verifies nothing.
 */
const TEAM_ID = /^[A-Z0-9]{10}$/;

export type ParsedAppId =
  | { ok: true; appId: string; teamId: string }
  | { ok: false; reason: "missing" | "malformed" };

/**
 * Read `IOS_APP_TEAM_ID` and build the App ID.
 *
 * Accepts either the bare Team ID (`ABCDE12345`) or the full App ID
 * (`ABCDE12345.com.matjarlb.app`), because both are things a person reasonably
 * has on their clipboard — the portal shows the former, most tutorials show the
 * latter. Anything else is rejected rather than coerced.
 */
export function parseAppId(raw: string | undefined): ParsedAppId {
  const cleaned = (raw ?? "").replace(/\s+/g, "");
  if (!cleaned) return { ok: false, reason: "missing" };

  const teamId = cleaned.includes(".")
    ? cleaned.slice(0, cleaned.indexOf("."))
    : cleaned;

  // If they pasted a full App ID, the bundle half has to be ours. A Team ID
  // paired with somebody else's bundle would serve a document that hands our
  // domain to an app we do not control.
  if (cleaned.includes(".")) {
    const bundle = cleaned.slice(cleaned.indexOf(".") + 1);
    if (bundle !== IOS_BUNDLE_ID) return { ok: false, reason: "malformed" };
  }

  const upper = teamId.toUpperCase();
  if (!TEAM_ID.test(upper)) return { ok: false, reason: "malformed" };

  return { ok: true, appId: `${upper}.${IOS_BUNDLE_ID}`, teamId: upper };
}

/**
 * The AASA document.
 *
 * Uses the modern `components` form rather than the legacy `paths` array, and
 * excludes the routes that must stay in a browser:
 *
 *  - `/api/*` — server endpoints; opening those in the app shows nothing.
 *  - `/auth/*` and the password-reset flow — an email link that opens the app
 *    mid-recovery strands the user, because the recovery token is consumed by
 *    the web session. This is the classic universal-links footgun and the
 *    reason `paths` exists at all.
 *  - `/.well-known/*` — verification files.
 *
 * `appclips` and `webcredentials` are deliberately absent: there is no App Clip,
 * and no password autofill association, so declaring either would be a claim
 * with nothing behind it.
 */
export function appSiteAssociation(appId: string) {
  return {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [
            { "/": "/api/*", exclude: true, comment: "server endpoints" },
            {
              "/": "/*/reset-password*",
              exclude: true,
              comment: "recovery token is consumed by the web session",
            },
            {
              "/": "/*/forgot-password*",
              exclude: true,
              comment: "recovery flow stays in the browser",
            },
            { "/": "/auth/*", exclude: true, comment: "auth callbacks" },
            { "/": "/.well-known/*", exclude: true, comment: "verification" },
            { "/": "/*" },
          ],
        },
      ],
    },
  };
}
