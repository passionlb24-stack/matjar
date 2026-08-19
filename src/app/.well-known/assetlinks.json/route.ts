import { NextResponse } from "next/server";
import {
  ANDROID_PACKAGE_NAME,
  assetLinksDocument,
  parseFingerprints,
} from "@/lib/assetlinks";

// Digital Asset Links — the file Android fetches to decide whether this domain
// vouches for the app (MP-030).
//
// The Android manifest declares `android:autoVerify="true"` for matjarlb.com.
// That declaration is a *claim by the app*; it is worthless until the domain
// answers back. Android fetches exactly this URL, over https, on the apex host,
// with no redirect, and compares the SHA-256 of the certificate the installed
// APK is signed with against the list served here. No match, no App Links —
// https links keep opening the browser.
//
// The fingerprint is the entire content of this file and it is deploy-specific:
// a Play-signed release is signed with *Google's* key, not the upload keystore.
// So it comes from an environment variable and never from the repo. A committed
// placeholder would be worse than nothing — it serves 200, verifies nothing, and
// looks finished.
//
// When the variable is missing or malformed we log and return 503. An empty
// array would be a valid-looking JSON document that silently disables App Links
// forever; a 503 makes a broken deploy visible in the logs and to `curl`.

// Read the env var per request rather than baking it into a prerender, so
// rotating the value in Vercel takes effect without a stale cached body.
export const dynamic = "force-dynamic";

export async function GET() {
  const { fingerprints, invalid } = parseFingerprints(
    process.env.ANDROID_APP_CERT_SHA256,
  );

  if (invalid.length > 0) {
    // Log how many entries are bad, never the value itself.
    console.error(
      `[assetlinks] ANDROID_APP_CERT_SHA256 has ${
        invalid.length === 1 ? "1 entry that is" : `${invalid.length} entries that are`
      } not a SHA-256 certificate fingerprint. Expected 32 colon-separated hex pairs — the "SHA256:" line from "keytool -list -v", or the App signing key certificate in the Play Console. Android App Links for ${ANDROID_PACKAGE_NAME} are disabled until this is fixed.`,
    );
    return NextResponse.json(
      {
        error: "invalid_fingerprint",
        detail:
          "ANDROID_APP_CERT_SHA256 is set but is not a valid SHA-256 certificate fingerprint. See docs/android-app-links.md.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (fingerprints.length === 0) {
    console.error(
      `[assetlinks] ANDROID_APP_CERT_SHA256 is not set. Android App Links for ${ANDROID_PACKAGE_NAME} cannot verify, so https links will keep opening the browser instead of the app. See docs/android-app-links.md.`,
    );
    return NextResponse.json(
      {
        error: "not_configured",
        detail:
          "ANDROID_APP_CERT_SHA256 is not set on this deployment. See docs/android-app-links.md.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // NextResponse.json sets `content-type: application/json`, which is what the
  // Android verifier requires.
  return NextResponse.json(assetLinksDocument(fingerprints), {
    status: 200,
    headers: {
      // Short enough that a fingerprint fix propagates the same day, long
      // enough that the verifier's retries stay cheap.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
