# Putting Matjar on Google Play

Written for someone who is not a developer. Every step says what it does and
what it costs. Nothing here needs Android Studio or a Mac.

## What the app actually is

The Android app is a shell that opens `https://matjarlb.com` and adds the
things a website cannot do on its own: push notifications, the camera, the
share sheet, precise location, and links that open the app instead of the
browser.

The practical consequence is the good kind: **a change to the website is a
change to the app.** Fix a price, add a store, redesign the checkout — it is
live in the app as soon as Vercel finishes deploying, with no new upload and no
review. You only build and upload a new APK when something *native* changes: the
app icon, the name, the permissions, the plugins, or the Android version target.

Expect that to be a few times a year, not weekly.

## What only you can do

Two things are tied to your identity and cannot be done for you.

1. **A Google Play developer account** — a one-time **$25**, at
   <https://play.google.com/console>. Google verifies who you are: for an
   individual account, expect to submit an ID document and a phone number, and
   allow a few days. Since 2023 individual accounts also have to run a **closed
   test with 12 testers for 14 continuous days** before they may publish
   publicly. Start that clock early; it is usually the longest part.
2. **The upload key** — see below. It is a file only you should hold.

## Step 1 — install a test APK on your own phone (free, do it first)

Before spending anything, see the app on your phone.

1. In GitHub, open the **Actions** tab.
2. Choose **Android** in the left column, then **Run workflow**.
3. Leave the choice on **debug** and confirm.
4. Wait for the green tick, open the finished run, and download
   **matjar-debug-apk** at the bottom.
5. Unzip it, move the `.apk` onto your phone, and open it. Android will ask you
   to allow installing from this source — that warning is expected for any app
   that did not come from the Play Store.

This APK is signed with Android's public throwaway debug key. It runs; it can
never be uploaded to Play. That is the point of it — you can hand it to anyone
to try without touching the store at all.

## Step 2 — create the upload key (once, and forever)

The key is a file that proves an update came from you. **Google will reject any
update signed with a different key, and there is no way to appeal that.** Losing
it means losing the ability to update the app under the same listing.

You need `keytool`, which comes with Java. If you do not have Java, the simplest
route is to ask a developer for ten minutes, or install Temurin JDK 21 from
<https://adoptium.net>.

```bash
keytool -genkeypair -v -keystore matjar.jks -keyalg RSA -keysize 2048 -validity 10000 -alias matjar
```

It asks for a password and some details. Keep the password. Keep the file.

Then put both somewhere you will still have in five years — a password manager
is right; a laptop is not.

## Step 3 — give GitHub the key

Turn the file into text:

```bash
base64 -w0 matjar.jks > matjar.jks.txt
```

In GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, four times.

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the whole contents of `matjar.jks.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the password you chose |
| `ANDROID_KEY_ALIAS` | `matjar` |
| `ANDROID_KEY_PASSWORD` | the password you chose |

GitHub secrets are write-only: nobody, including you, can read them back
afterwards. That is why you keep your own copy.

Delete `matjar.jks.txt` when you are done. Keep `matjar.jks`.

## Step 4 — build the file Play wants

Actions → **Android** → **Run workflow** → choose **release**.

Download **matjar-release-aab**. That `.aab` is what you upload.

If the run stops immediately saying the secrets are missing, step 3 is
incomplete — the workflow checks before building so you find out in seconds
rather than after a five-minute build.

## Step 5 — the listing

In the Play Console you will be asked for material the build cannot supply:

- App name, short description, full description — **in Arabic**, since that is
  who uses Matjar
- A 512×512 icon and a 1024×500 feature graphic
- At least two phone screenshots
- A privacy policy URL — `https://matjarlb.com/ar/privacy` already exists
- A content rating questionnaire, and a data-safety form

On the data-safety form, answer for what the app collects: account email, name,
phone number, delivery address, and approximate location. Matjar takes no card
details — it is cash on delivery — and saying so is worth saying plainly.

## Things that will bite

- **The version number must climb with every upload.** The workflow does this
  for you from the run number, so you cannot forget it. `versionName` — the
  number a customer sees — stays whatever `android/app/build.gradle` says, and
  is yours to change when it means something.
- **`applicationId` is `com.matjarlb.app` and can never change.** It is the
  app's identity on Play. A different id is a different app with zero installs.
- **Google raises the required `targetSdk` every year.** When Play warns you,
  the fix is `android/variables.gradle` and a fresh release build.
- **Deep links need a fingerprint.** `/.well-known/assetlinks.json` is already
  served but returns 503 until `ANDROID_APP_CERT_SHA256` is set in Vercel. Play
  Console shows the SHA-256 under **Setup → App integrity** once you have
  uploaded a release. Until then, links open in the browser rather than the app
  — everything else works.
