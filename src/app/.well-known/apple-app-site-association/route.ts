import { NextResponse } from "next/server";
import { IOS_BUNDLE_ID, appSiteAssociation, parseAppId } from "@/lib/applinks";

// Apple App Site Association — the iOS counterpart to assetlinks.json.
//
// Until now this did not exist at all. The Android half was built and is waiting
// on a fingerprint; the iOS half had nothing, so every https link Matjar sends —
// a push payload, a merchant's WhatsApp share, an order confirmation — opened
// Safari rather than the app, on every iPhone, with no error anywhere.
//
// Three things iOS insists on, each of which silently kills verification:
//
//  1. The path is exactly /.well-known/apple-app-site-association, with NO file
//     extension. A route directory named `apple-app-site-association` is what
//     produces that; adding `.json` would serve a URL Apple never fetches.
//  2. `content-type: application/json`, and the body must NOT be signed. Apple
//     dropped the signed-CMS form years ago and now rejects it.
//  3. No redirect. `src/proxy.ts` already excludes `.well-known` explicitly, and
//     a test asserts that exclusion — see the comment on the matcher.
//
// Unlike Android, Apple does not fetch this from the device: its CDN crawls it
// and the device trusts the CDN's copy. So a broken document can persist for
// users after it is fixed at the origin, which is exactly why this fails loudly
// rather than serving a plausible-looking empty document.

export const dynamic = "force-dynamic";

export async function GET() {
  const parsed = parseAppId(process.env.IOS_APP_TEAM_ID);

  if (!parsed.ok) {
    // Never log the value — a Team ID is not a secret, but the habit of logging
    // whatever is in an env var is how secrets end up in logs.
    console.error(
      parsed.reason === "missing"
        ? `[aasa] IOS_APP_TEAM_ID is not set. Universal Links for ${IOS_BUNDLE_ID} cannot verify, so https links keep opening Safari instead of the app. See docs/ios-universal-links.md.`
        : `[aasa] IOS_APP_TEAM_ID is set but is not a 10-character Apple Team ID (optionally suffixed with .${IOS_BUNDLE_ID}). Universal Links are disabled until this is fixed. See docs/ios-universal-links.md.`,
    );
    return NextResponse.json(
      {
        error: parsed.reason === "missing" ? "not_configured" : "invalid_team_id",
        detail:
          parsed.reason === "missing"
            ? "IOS_APP_TEAM_ID is not set on this deployment. See docs/ios-universal-links.md."
            : "IOS_APP_TEAM_ID is set but is not a valid Apple Team ID. See docs/ios-universal-links.md.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(appSiteAssociation(parsed.appId), {
    status: 200,
    headers: {
      // Apple's CDN caches aggressively regardless; keep the origin value short
      // so a correction propagates as fast as Apple allows.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
