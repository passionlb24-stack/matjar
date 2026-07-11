# Matjar mobile app (Capacitor)

Matjar ships to the App Store and Google Play as a **hosted-hybrid Capacitor
app**: the native shell loads the live site (`https://matjarlb.com`) and layers
native capabilities on top (push, geolocation, camera, share, deep links). There
is **one codebase** — the web app *is* the app. Content/UX changes deploy the
normal way (push to `main` → Vercel); you only rebuild the native binary when
native config or plugins change.

## Layout

- `capacitor.config.ts` — app id (`com.matjarlb.app`), name, `server.url`, splash/push config.
- `native-shell/` — the loading/offline fallback screen shown before the live site loads.
- `src/components/native-bridge.tsx` — mounted in the root layout; a no-op on the
  web, wires splash/status-bar/back-button/deep-links/push when running natively.
- `android/`, `ios/` — the native projects (committed; build artifacts are gitignored).
- `supabase/migrations/0067_device_push_tokens.sql` — stores FCM/APNs device tokens.

## Prerequisites

| Target | Needs |
| --- | --- |
| Android | Android Studio + JDK 17. Google Play Console account ($25 one-time). |
| iOS | **A Mac** with Xcode (or a cloud macOS CI like Codemagic/Ionic Appflow — this repo can be built there without owning a Mac). Apple Developer account ($99/yr). |

> This project was scaffolded on Windows. Android is buildable locally; iOS
> requires a Mac or cloud macOS build. Creating developer accounts, signing, and
> store submission are done by you (they need credentials/identity).

## One-time setup before first build

1. **Apply the migration** (adds `device_push_tokens` + `register_device_token` RPC):
   run `supabase/migrations/0067_device_push_tokens.sql` against the project.
2. **App icons & splash**: replace the placeholder icons. Easiest is
   `@capacitor/assets`: put a 1024×1024 `icon.png` and a splash in `assets/`, then
   `npx @capacitor/assets generate`.
3. **Push (see below)** if you want native notifications at launch.

## Dev workflow

```bash
# Point the shell at a local dev server (same Wi-Fi; use your machine's LAN IP)
CAP_SERVER_URL=http://192.168.1.x:3000 npx cap sync

# Android: open in Android Studio and Run on a device/emulator
npm run cap:android

# iOS (on a Mac): open in Xcode and Run
npm run cap:ios
```

For a production build, leave `CAP_SERVER_URL` unset — it defaults to
`https://matjarlb.com`. Run `npm run cap:sync` after any native/plugin change.

## Push notifications (follow-up — needs your Firebase project)

The client side is already wired: `native-bridge.tsx` requests permission for
signed-in users, registers the device, and stores the FCM/APNs token via the
`register_device_token` RPC. Two pieces remain, both requiring your credentials:

1. **Android (FCM)**: create a Firebase project, add an Android app with id
   `com.matjarlb.app`, download `google-services.json` into `android/app/`, and add
   the Google Services Gradle plugin (Capacitor push docs). 
2. **iOS (APNs)**: enable the Push Notifications capability in Xcode, and upload an
   APNs key to Firebase (FCM proxies APNs).
3. **Backend sender**: the existing web-push trigger (`push_on_notification`) sends
   to `push_subscriptions` via VAPID. Add a parallel path that reads
   `list_user_device_tokens(user_id)` and calls the **FCM HTTP v1 API** with a
   service-account token. This is the only new backend work; the notification
   *triggers* stay unchanged.

## Deep links / App Links

- **Android**: the manifest already declares an `autoVerify` intent-filter for
  `matjarlb.com`. Host `https://matjarlb.com/.well-known/assetlinks.json` with the
  app's SHA-256 signing fingerprint to make links open the app automatically.
- **iOS**: add the Associated Domains capability (`applinks:matjarlb.com`) in Xcode
  and host `https://matjarlb.com/.well-known/apple-app-site-association`.

## Store submission checklist

- [ ] Bump `CFBundleShortVersionString` / `versionName` and build numbers.
- [ ] Icons + splash generated; screenshots for each store.
- [ ] Privacy policy URL (already at `/privacy`), data-safety form.
- [ ] Apple: the app has real native features (push, location, camera) → passes
      guideline 4.2 (not "just a website").
- [ ] Android: signed AAB (`./gradlew bundleRelease`), upload to Play Console.
- [ ] iOS: Archive in Xcode → upload to App Store Connect (or Codemagic).
