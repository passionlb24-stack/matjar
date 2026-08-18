# App Links / Universal Links — what the owner must do (MP-030)

**Status: owner-blocked.** The Android manifest
(`android/app/src/main/AndroidManifest.xml`) declares an `autoVerify` App Links
intent filter for `matjarlb.com` and `www.matjarlb.com`, but the site serves no
`/.well-known/assetlinks.json`, so Android's verification fails and https links
never open the installed app.

We deliberately did **not** ship a placeholder `public/.well-known/assetlinks.json`:
the file's only content is the app's signing-certificate SHA-256 fingerprint,
which only the owner (via the Play Console or the keystore) can produce. A file
with a wrong or empty fingerprint would be served successfully and verify
nothing — worse than a missing file, because it looks done.

## 1. Get the signing-cert SHA-256 fingerprint

The fingerprint must be the certificate the **delivered** APK is signed with.
If the app uses **Play App Signing** (it almost certainly does once uploaded),
that is Google's key, not the upload keystore:

- **Play Console** → app → *Setup* → *App integrity* → *App signing* →
  copy the **SHA-256 certificate fingerprint** under "App signing key
  certificate". Play Console also generates the exact `assetlinks.json` on that
  page — you can paste it verbatim.
- For a locally-signed build instead:

  ```
  keytool -list -v -keystore <your-keystore.jks> -alias <alias>
  ```

  and copy the `SHA256:` line.

If both a Play-signed release and local debug/sideload builds must open links,
include **both** fingerprints in the array below.

## 2. Create `public/.well-known/assetlinks.json`

Package name is `com.matjarlb.app` (from `android/app/build.gradle`). Paste,
replacing the placeholder fingerprint:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.matjarlb.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

Next.js serves `public/` as-is, so the file will be available at
`https://matjarlb.com/.well-known/assetlinks.json`. It must return HTTP 200
with `Content-Type: application/json` (Next does this for `.json` files) and no
redirect from `https://matjarlb.com` — verify with:

```
curl -i https://matjarlb.com/.well-known/assetlinks.json
```

Then test on a device:

```
adb shell pm verify-app-links --re-verify com.matjarlb.app
adb shell pm get-app-links com.matjarlb.app
```

or use https://developers.google.com/digital-asset-links/tools/generator

## 3. iOS (Universal Links) — only if/when an iOS app exists

The iOS equivalent is `public/.well-known/apple-app-site-association`
(**no file extension**, must be served as `application/json`). It requires the
Apple **Team ID** and bundle identifier:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.matjarlb.app",
        "paths": ["*"]
      }
    ]
  }
}
```

Because the file has no extension, Next.js will serve it as
`application/octet-stream`; iOS historically tolerates that, but the safe route
is a header override in `next.config.ts` (or `vercel.json`):

```ts
async headers() {
  return [
    {
      source: "/.well-known/apple-app-site-association",
      headers: [{ key: "Content-Type", value: "application/json" }],
    },
  ];
}
```

There is no iOS app in this repo today, so this half is informational until one
exists — do not serve an `appID` that isn't real.
