# Brief: put Matjar on Google Play

**For whoever picks this up — a Claude Code session or a person.** Everything
below was verified against this repository and the live site on 2026-08-24, not
copied from generic Play Store advice. Where something is unverified it says so.

The owner is **not a developer** and communicates in Lebanese Arabic. Explain in
plain language, do the technical work yourself, and only ask him for the things
that genuinely require his identity or his decision — they are listed in §1.

---

## 0. What this app is, before you change anything

Matjar is a **hosted-hybrid Capacitor shell**. The Android app is a WebView
pointed at `https://matjarlb.com`; it adds push, camera, geolocation, share and
deep links on top. **The website is the app.**

Two consequences that shape every decision here:

- A change to the website is live in the app the moment Vercel deploys. You do
  **not** ship an APK for a UI change, a price, a new store, or a bug fix.
- You ship a new APK only when something *native* changes: icon, app name,
  permissions, Capacitor plugins, or the `targetSdk`. Expect a few times a year.

So: **do not "port" the site into a native app.** If someone asks for that,
push back — it means two codebases and a Play review for every fix.

---

## 1. The four things only the owner can do

Nobody can do these on his behalf. Get them moving early; two of them have long
waits.

1. **A Google Play developer account — one-time $25**, at
   <https://play.google.com/console>. Google verifies identity: expect an ID
   document and a phone number, and allow several days.
2. **The 12-tester closed test.** Individual (non-organisation) accounts must
   run a closed test with **at least 12 testers for 14 continuous days** before
   they may publish publicly. This is usually the longest pole. Start it the day
   the account is approved, with 12 real people who will actually install.
   *Verify the current rule in the Console — Google has changed it before, and
   this brief cannot be the source of truth for Google's policy.*
3. **The upload key.** See §4. Google will reject any update signed with a
   different key and there is no appeal. He must keep the file and its password
   somewhere that survives a lost laptop — a password manager, not a desktop.
4. **Store listing copy and screenshots** — his words about his own business.
   §6 gives him a starting draft to edit rather than a blank page.

---

## 2. App identity — already decided, do not change

| | value |
|---|---|
| `applicationId` | `com.matjarlb.app` |
| App name (Android) | `متجر` (`android/app/src/main/res/values/strings.xml`) |
| `minSdkVersion` | 24 |
| `compileSdkVersion` / `targetSdkVersion` | 36 |
| Server URL | `https://matjarlb.com` (`capacitor.config.ts`) |

`applicationId` **can never change** — it is the app's identity on Play, and a
different one is a different app with zero installs.

`targetSdk 36` currently satisfies Play. Google raises the floor every year;
when the Console warns, the fix is `android/variables.gradle` plus a fresh
release build.

---

## 3. How builds work here — read before touching CI

`.github/workflows/android.yml`. There is **no Java or Android SDK on the
owner's machine**; GitHub's ubuntu runner is the build machine.

Two ways in:

- **Actions → Android → Run workflow**, choosing `debug` or `release`.
- **Push a tag `apk-*`** (e.g. `git tag apk-2026-08-24 && git push origin
  apk-2026-08-24`). Tags always build **debug**, deliberately: a tag must never
  be able to spend the signing key by accident. A debug tag build is also
  published as a **public GitHub Release asset**, so the APK is a plain URL that
  installs from a phone with no GitHub account.

`release` produces the `.aab` for Play and requires the four secrets in §4. It
checks for them *before* building, so a missing secret fails in seconds with a
readable message.

**Version stamping.** `versionCode` comes from the run number; debug builds also
get `versionName test-<run>`. Do not hand-edit these — and do not remove the
stamping, for a reason worth keeping:

> Every debug APK originally shipped as `versionCode 1`. Android could not tell
> one from the next, so installing a newer one over an older one is a
> same-version reinstall — the case where a device can quietly decline and leave
> the old app running. It cost a full debugging cycle.

**Two traps already hit in this workflow. Do not reintroduce them:**

1. The stamp step must run **before** `npx cap sync android`. `cap sync` writes
   `capacitor.config.ts` into the Android project; a stamp applied afterwards
   edits a file the APK no longer reads.
2. The build number reaches the app through the **`MATJAR_BUILD` environment
   variable**, read by `capacitor.config.ts`. An earlier version `sed`-ed for
   the literal `MatjarApp/1`, which does not appear in that file (the value is
   assembled from a constant) — it matched nothing and **exited 0**. There is
   now a step that greps the generated
   `android/app/src/main/assets/capacitor.config.json` and fails the build if
   the value is absent. **Keep that step.** Printing a value is not evidence it
   arrived.

---

## 4. The upload key

`keytool` ships with Java. If the owner has no Java, install Temurin JDK 21
(<https://adoptium.net>) or have a developer do this step.

```bash
keytool -genkeypair -v -keystore matjar.jks -keyalg RSA -keysize 2048 -validity 10000 -alias matjar
```

Then base64 it and add four **repository secrets** under Settings → Secrets and
variables → Actions:

| secret | value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 matjar.jks` output |
| `ANDROID_KEYSTORE_PASSWORD` | the password chosen above |
| `ANDROID_KEY_ALIAS` | `matjar` |
| `ANDROID_KEY_PASSWORD` | the same password |

Delete the base64 text file afterwards. Keep `matjar.jks` forever.

GitHub secrets are write-only — nobody can read them back, which is why he keeps
his own copy.

`android/app/build.gradle` already has a `signingConfigs.release` block that
reads these from the environment and **defines nothing when they are absent**,
so debug builds on a machine that has never seen the key keep working. Capacitor
generates no release signing config at all, so without this block
`bundleRelease` produces an unsigned bundle that builds cleanly and that Play
rejects on upload.

**Recommended:** opt into **Play App Signing** in the Console. Google then holds
the app signing key and this keystore is only the *upload* key, which Google can
reset if it is ever lost. Without it, losing `matjar.jks` ends the ability to
update the listing.

---

## 5. The Data Safety form — answer it from this, it is verified

Play requires this to be accurate, and a wrong answer is a policy violation.
These come from the live schema, not from guesswork.

**Collected, and linked to the user's identity:**

| data | where | why |
|---|---|---|
| Name | `profiles.full_name`, `orders.customer_name`, `bookings.customer_name` | to deliver and to greet |
| Phone number | `profiles.phone`, `orders.phone`, `bookings.phone` | **this is the delivery mechanism** — Matjar is cash-on-delivery and the merchant rings the customer |
| Address | `orders.address` | delivery |
| Email | Supabase Auth | account |
| Approximate / precise location | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | finding nearby shops on the map |
| Photos | `CAMERA` | merchants photographing their own products |
| Push token | `push_subscriptions.endpoint` | order notifications |

**Declare truthfully, and it is a selling point:**

- **No payment information is collected at all.** Matjar is cash on delivery.
  There is no card processing anywhere in the product. Say so plainly.
- Data is encrypted in transit (HTTPS everywhere).
- Users can request deletion — see below.

**Account deletion.** Play requires both an in-app path and a publicly reachable
URL explaining it. Both exist: `src/components/delete-account.tsx` calls the
`delete_my_account` RPC, and `https://matjarlb.com/ar/privacy` documents it
(verified: the page contains «حذف الحساب»). Give Play the privacy URL for the
deletion request link.

**Declared permissions** (`android/app/src/main/AndroidManifest.xml`) — exactly
five, and be ready to justify each in the Console:
`INTERNET`, `CAMERA`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`,
`POST_NOTIFICATIONS`.

---

## 6. Store listing — a draft to edit, not to ship as-is

**Arabic is the primary listing.** Almost every user is Lebanese. Add English as
a secondary locale.

- **App name (30 chars):** `متجر — متاجر ومطاعم لبنان`
- **Short description (80 chars):** `اطلب من متاجر ومطاعم لبنان، واحجز مواعيدك — والدفع نقداً عند الاستلام.`
- **Full description:** must mention, in his own words: multi-sector (shops,
  restaurants, clinics, services), cash on delivery, ordering, appointment
  booking, and that it is Lebanese. Do not promise a feature the platform does
  not have.

**Graphics needed:**

| asset | size | source |
|---|---|---|
| App icon | 512×512 PNG | `public/icons/icon-512.png` already exists |
| Feature graphic | 1024×500 PNG | **must be designed — does not exist yet** |
| Phone screenshots | ≥2, min 320px side | capture from the app |

**Screenshots to take** (the redesigned screens, in Arabic, on a phone):
Home with the four sector gateways · a storefront (ملحمة البركة) · the search
screen · checkout showing cash-on-delivery · «طلباتي» with the progress track.

**Privacy policy URL:** `https://matjarlb.com/ar/privacy` — verified live, 200.

---

## 7. Deep links — currently broken, and it is a one-value fix

`https://matjarlb.com/.well-known/assetlinks.json` returns **503** because the
env var `ANDROID_APP_CERT_SHA256` is not set in Vercel. Until it is set, links
to matjarlb.com open in the browser instead of the app. Everything else works.

After the first release upload, the Console shows the SHA-256 under
**Setup → App integrity**. Put it in Vercel as `ANDROID_APP_CERT_SHA256`,
redeploy, then confirm the URL returns 200 and contains that fingerprint.

Use the app-signing certificate Google shows you, **not** the local keystore's
fingerprint, if Play App Signing is enabled — they differ, and using the wrong
one silently fails.

---

## 8. Order of work

1. Owner starts the $25 account and identity verification. *(blocking, days)*
2. Meanwhile: design the 1024×500 feature graphic, capture screenshots, draft
   the Arabic listing with him.
3. Owner creates the keystore; you add the four secrets.
4. Run the workflow with `release`; download the `.aab`.
5. Create the app in the Console, upload the bundle, fill Data Safety from §5.
6. Start the 12-tester closed test immediately. *(blocking, 14 days)*
7. Set `ANDROID_APP_CERT_SHA256` in Vercel, verify assetlinks returns 200.
8. After the test window, promote to production.

---

## 9. Rules for whoever does this work

- **Verify, do not assume.** This project has repeatedly been bitten by steps
  that reported success and did nothing: a CSS rule that compiled locally and
  never reached production, a `sed` that matched nothing and exited 0, a stamp
  applied after the file was consumed. After any change, check the *artifact*,
  not the log.
- **Do not change business logic, money, or order state** to satisfy a store
  requirement. If Play seems to demand it, say so and stop.
- **Never commit the keystore, its password, or any secret key** to the repo.
- **Do not place a real order** while testing — it notifies a real merchant and
  rings a real phone. Walk to the confirm button and stop.
- **Arabic must be natural Lebanese-market Arabic**, not translated-from-English
  Arabic, and there is **no emoji in this product's UI**.
- Report honestly what you did and did not verify. Not verified here: the native
  binary has never been run on a physical device by the assistant, and no
  signed-in merchant or customer screen has been rendered with real data.

---

## 10. Useful paths

```
.github/workflows/android.yml   the build
capacitor.config.ts             server URL, UA token, MATJAR_BUILD
android/app/build.gradle        applicationId, version, release signing
android/app/src/main/AndroidManifest.xml   permissions
android/app/src/main/res/values/strings.xml  app name (متجر)
docs/ANDROID_RELEASE.md         the owner-facing version of §4 and §8
src/lib/app-mode.ts             how the app knows it is not a browser
src/components/delete-account.tsx   account deletion (Play requirement)
public/icons/icon-512.png       the 512 icon
```
