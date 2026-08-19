# App Links / Universal Links — the owner's checklist (MP-030)

**What this is for.** Right now, tapping a `matjarlb.com` link on a phone that
has the Matjar app installed opens the **browser**, not the app. This document
is the list of steps that fixes that. It takes about ten minutes and needs no
programming.

**Why it is not already done.** Android only opens links in the app if the
website publicly says "yes, that app is mine". It says so by serving one small
file. The entire content of that file is a **fingerprint** of the key your app
is signed with — and that key lives in your Google Play account, not in this
code. Nobody but you can read it. So the site was built to serve the file, with
a blank where the fingerprint goes, and you fill the blank in.

**What has already been done for you (nothing to do here):**

- The app itself already claims the domain
  (`android/app/src/main/AndroidManifest.xml`, the `autoVerify` block).
- The website already serves the file at
  `https://matjarlb.com/.well-known/assetlinks.json`, from
  `src/app/.well-known/assetlinks.json/route.ts`.
- That address is deliberately excluded from the Arabic/English URL redirect, so
  it answers directly with no redirect (Android rejects the file if it is
  redirected). There is a test asserting this in
  `src/lib/__tests__/assetlinks.test.ts`.
- Until you complete step 2 below, that address answers **503** with
  `{"error":"not_configured"}` and writes a line into the Vercel logs. That is on
  purpose: a broken setup that is loud is much better than one that quietly
  serves an empty file and looks finished.

---

## Step 1 — Copy the fingerprint

You need the fingerprint of the key that signs the app **users actually
download**. If the app is on Google Play, that is Google's key, **not** the file
on your own computer. Getting this wrong is the single most common mistake.

### If the app is on Google Play (this is almost certainly you)

1. Open <https://play.google.com/console> and sign in.
2. Choose the **Matjar** app.
3. In the left menu: **Test and release** → **Setup** → **App integrity**.
   (On some accounts it is **Release** → **Setup** → **App integrity**.)
4. Open the **App signing** tab.
5. Find the box titled **App signing key certificate**.
6. Copy the long line labelled **SHA-256 certificate fingerprint**. It is 32
   pairs of letters/numbers separated by colons, and looks like this:

   ```
   FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
   ```

   Copy **only that value**, not the words "SHA-256 certificate fingerprint" in
   front of it.

> On that same Play Console page Google also shows a ready-made
> `assetlinks.json` file. **You do not need it.** This site builds that file for
> you. You only need the one fingerprint line.

### If the app is not on Play yet, and you sign it yourself

Open a terminal in the folder holding your keystore file and run this one
command, replacing the two names in angle brackets:

```
keytool -list -v -keystore <your-keystore.jks> -alias <your-key-alias>
```

It asks for the keystore password, then prints several lines. Copy the value on
the line that begins `SHA256:` — again, just the colon-separated value.

### If you need both

If a Play release **and** a build you install by hand both need to open links,
you will have two fingerprints. Keep both; in the next step you paste them on
one line separated by a comma:

```
FA:C6:...:9C,11:22:...:FF
```

---

## Step 2 — Paste it into Vercel

1. Open <https://vercel.com> and sign in.
2. Open the **matjar** project.
3. Top menu: **Settings**.
4. Left menu: **Environment Variables**.
5. Click **Add New**.
6. Fill it in exactly:
   - **Key**: `ANDROID_APP_CERT_SHA256`
   - **Value**: paste the fingerprint you copied in step 1
   - **Environments**: tick **Production** (ticking Preview and Development too
     is harmless)
7. Click **Save**.

> This value is **not a secret**. A certificate fingerprint is public
> information — it is meant to be readable by anyone on the internet, which is
> the entire point of the file. It lives in Vercel rather than in the code only
> so that it can be changed without a code change.

## Step 3 — Redeploy

An environment variable only takes effect on the next deploy.

1. In the Vercel project, open the **Deployments** tab.
2. Find the deployment at the top of the list (the current Production one).
3. Click the **⋯** button on its right → **Redeploy** → confirm **Redeploy**.
4. Wait for the status to turn **Ready** (usually 1–3 minutes).

## Step 4 — Check that it worked

Open this address in any browser, on any device:

**<https://matjarlb.com/.well-known/assetlinks.json>**

**It worked** if you see a block of text like this, with *your* fingerprint in
it:

```json
[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"com.matjarlb.app","sha256_cert_fingerprints":["FA:C6:..."]}}]
```

**It did not work** if you see one of these instead:

| What you see | What it means | What to do |
| --- | --- | --- |
| `{"error":"not_configured"}` | Vercel does not have the variable, or you have not redeployed since adding it. | Redo steps 2 and 3. Check the key is spelled `ANDROID_APP_CERT_SHA256` exactly. |
| `{"error":"invalid_fingerprint"}` | The pasted value is not a fingerprint — usually the words `SHA256:` got copied along with it, or part of the line is missing. | Redo step 1, copy only the colon-separated value, then steps 2 and 3. |
| A 404 page | The deploy has not finished, or it failed. | Check the Deployments tab. |

Then confirm Google agrees, using their official checker:

<https://developers.google.com/digital-asset-links/tools/generator>

Fill in: hosting site `https://matjarlb.com`, app package name
`com.matjarlb.app`, and the same fingerprint. Press **Test statement**. You want
a green **Success**.

## Step 5 — Check it on a real phone

Verification happens when the app is **installed**, so this step only works once
the app has been published or side-loaded.

1. Install the app from Play on an Android phone.
2. Send yourself any `https://matjarlb.com/...` link (WhatsApp is fine).
3. Tap it. It should open **inside the Matjar app**, with no browser and no
   "open with" chooser.

If it still opens the browser, uninstall and reinstall the app: Android only
re-checks the website when the app is installed, and it remembers a failure.

---

## Two things that still need a decision

### 1. `www.matjarlb.com` is claimed but probably cannot verify

The app's manifest claims **two** hosts:

```xml
<data android:scheme="https" android:host="matjarlb.com" />
<data android:scheme="https" android:host="www.matjarlb.com" />
```

Android checks **each host separately**, and counts any redirect as a failure.
If `www.matjarlb.com` redirects to `matjarlb.com` — the normal Vercel setup —
then `https://www.matjarlb.com/.well-known/assetlinks.json` redirects too, and
that host can never verify. On Android 12 and newer, one failing host can sink
the whole verification.

Check it by opening `https://www.matjarlb.com/.well-known/assetlinks.json` in a
browser. If the address bar jumps to `matjarlb.com`, it is redirecting.

Two ways to resolve it, both needing a new app build:

- **Simplest**: delete the `www.matjarlb.com` line from the manifest and
  rebuild. Links to `www.` still work — they open in the browser, which then
  redirects. Almost nobody types `www.` any more.
- **Alternative**: configure `www.matjarlb.com` in Vercel as a real domain
  serving the app rather than a redirect, so it answers the file directly.

**This has not been changed for you** — it alters what the shipped app claims,
which is a decision plus a rebuild, not a website edit.

### 2. iOS Universal Links are not set up

The Apple equivalent is a file at `/.well-known/apple-app-site-association`
(note: **no `.json` on the end**). It needs your Apple **Team ID**, which only
exists once there is an Apple Developer account and an iOS app. There is no iOS
app in this repository yet, so nothing has been built for it. When there is one,
the work is:

1. In Xcode, add the **Associated Domains** capability with
   `applinks:matjarlb.com`.
2. Serve `/.well-known/apple-app-site-association` with
   `Content-Type: application/json`. The file has no extension, so the content
   type has to be set deliberately — the same route-handler approach used for
   `assetlinks.json` is the cleanest way.
3. Its content is
   `{"applinks":{"apps":[],"details":[{"appID":"<TEAMID>.com.matjarlb.app","paths":["*"]}]}}`.

Do not publish an `appID` that is not real. Like the Android file, one that
serves successfully and verifies nothing is worse than no file at all, because
it looks done.
