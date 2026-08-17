# 18 — Mobile app experience

**This builds on `audit/matjar-mobile-app-experience/` (20 documents,
`MOBILE_ISSUES.csv`, final state: 16 fixed, 1 partial, 2 deferred, 1 open).**
It does not restate what that audit found or fixed. Read it first.

**Verification limit, stated once.** Nothing here was seen on a device or in a
browser. The in-app pane cannot composite this application
(`audit/matjar-mobile-app-experience/18_BEFORE_AFTER.md` pinned the cause: page
content stays inside the React streaming boundary and never hydrates), and there
is no session to reach an authenticated screen. **No screenshots at eight
viewports. No Lighthouse score. No measured frame or install behaviour.** What
follows is read from source, tokens, native config and store-platform rules.

---

## 1. The thing the previous audit did not cover: there are two apps

The prior audit treated Matjar as a PWA. It is also a **Capacitor 8 native
binary**, and that changes what several of its conclusions mean.

```
capacitor.config.ts:11   const serverUrl = process.env.CAP_SERVER_URL || "https://matjarlb.com";
capacitor.config.ts:16   webDir: "native-shell"
capacitor.config.ts:19   server: { url: serverUrl, androidScheme: "https", ... }
```

This is a **hosted-hybrid** app: the native shell is a WebView pointed at the
production origin. `native-shell/index.html` (81 lines) is not the app — it is
the splash/fallback shown before the remote origin answers.

So one codebase reaches customers through **two delivery mechanisms that share
an origin but not a runtime**:

| | PWA (browser / installed) | Capacitor binary |
|---|---|---|
| Origin | `matjarlb.com` | `matjarlb.com` (same) |
| HTML/JS/CSS | fetched from Vercel | fetched from Vercel |
| Install | `beforeinstallprompt` / iOS Share sheet | App Store / Play Store |
| Push | Web Push (VAPID) → `push_subscriptions` | FCM/APNs → `device_push_tokens` |
| Camera / GPS / Share | Web APIs | Capacitor plugins (`src/lib/native.ts`) |
| Splash | manifest `background_color` | `@capacitor/splash-screen`, 1200 ms |
| Back button | browser | `App.addListener("backButton")` (`native-bridge.tsx:40`) |
| Offline | `sw.js` → `/offline.html` | same SW, **plus** `native-shell/index.html` |
| Update | deploy to Vercel | deploy to Vercel (unless native config changed) |

The single-codebase decision is correct for a team of this size, and the code
respects it well: `native-bridge.tsx` is a no-op on the web and lazy-imports
every plugin (`native-bridge.tsx:19–20`), so the web bundle is untouched;
`src/lib/native.ts` gives each capability a native path and a web fallback in one
function. That is the right architecture.

The problems are all in the **seams**.

---

## 2. Seam 1 — push: two systems, one of them a dead end

### What exists

- **Web Push.** `PushOptIn` (`src/components/push-opt-in.tsx`) subscribes via
  VAPID into `push_subscriptions`. Delivery runs
  `notifications` INSERT → `push_on_notification` → `POST /api/push/hook`
  (`src/app/api/push/hook/route.ts`) → `web-push`.
- **Native push.** `native-bridge.tsx:92–97` requests notification permission for
  signed-in users and `:75–78` stores the FCM/APNs token via
  `register_device_token` into `device_push_tokens`
  (`supabase/migrations/0067_device_push_tokens.sql`).

### The defect

**Nothing reads `device_push_tokens`.** Repo-wide, the only writer is
`native-bridge.tsx` and the only other reference is the migration that creates
the table. There is no FCM sender. `MOBILE_APP.md` says so plainly in its own
follow-up section — "Add a parallel path that reads `list_user_device_tokens(user_id)`
and calls the FCM HTTP v1 API … This is the only new backend work."

So today the native app **asks for the notification permission and then never
uses it.** On iOS that permission prompt is offered once. Spending it on a
channel that cannot deliver is the most expensive silent bug in the mobile
surface: the customer says yes, hears nothing for a week, and turns
notifications off — and now the channel is closed for when it does work.

**Recommendation.** Do not ship the binary to a store until either (a) the FCM
sender exists, or (b) `native-bridge.tsx:92–97` is gated off. Option (b) is one
line and can ship today.

### The second defect: both systems can be on at once

`PushOptIn` renders unconditionally in `/account`
(`src/app/[lang]/(site)/account/page.tsx:103`) and in `push-notice.tsx:40`.
It is not gated on `Capacitor.isNativePlatform()`. Consequences:

- **iOS binary.** `PushManager` is absent in WKWebView, so `PushOptIn` resolves
  to `state = "unsupported"` (`push-opt-in.tsx:21–27`). The user sees "push not
  supported" inside an app that natively asked them for push thirty seconds
  earlier. That is a straight contradiction on a settings screen.
- **Android binary.** `PushManager` is generally available in the Android
  WebView, so the same user can register a Web Push subscription *and* an FCM
  token. Once the FCM sender exists, every notification arrives twice.

**Fix.** `PushOptIn` should render its native state when `isNative()` is true —
"notifications are managed in your phone's settings" — not the web control.
`src/lib/native.ts:6` already exposes exactly the check needed.

---

## 3. Seam 2 — install and deep links

### Deep links are wired on the app side and unverifiable on the web side

`android/app/src/main/AndroidManifest.xml:26–31` declares an
`android:autoVerify="true"` intent filter for `matjarlb.com` and
`www.matjarlb.com`. `native-bridge.tsx:46–54` handles `appUrlOpen` and routes it.

**`public/.well-known/` does not exist.** `public/` contains
`file.svg, globe.svg, googlefe3d550813c09b12.html, logo.png, next.svg,
offline.html, sw.js, vercel.svg, window.svg` — no `assetlinks.json`, no
`apple-app-site-association`, and no rewrite or route handler serving either
(`vercel.json` has no `rewrites`; `next.config.ts` has only `headers()`).

Consequences:

- **Android App Links verification will fail.** `autoVerify` requires
  `https://matjarlb.com/.well-known/assetlinks.json` carrying the app's SHA-256
  signing fingerprint. Without it the system does not associate the domain, and
  `https://matjarlb.com/...` links open in the browser rather than the app.
- **iOS Universal Links cannot work at all** — they require both the Associated
  Domains capability and `apple-app-site-association` served from the origin.

So the deep-link handler in `native-bridge.tsx` can only fire for custom-scheme
URLs today. Every share link, every push `url` payload, every WhatsApp link a
merchant sends lands in Safari or Chrome instead of the installed app. This is
the difference between "we shipped an app" and "we shipped an app people use".

Both files are content, not code, and both need a value only the owner has (the
Android signing fingerprint, the Apple team ID). That is why it is listed as a
blocker rather than a fix.

### Icons

Ground truth confirmed on disk: `src/app/apple-icon.png` and `src/app/icon.png`
are both **161,750 bytes** — the same 512×512 asset under two names. The manifest
(`src/app/manifest.ts:20–24`) declares three entries all pointing at
`/icon.png`, and says so honestly in its own comment. Still outstanding from the
prior audit as M-010 (partial):

- no dedicated 180×180 for the iOS home screen,
- no true 192×192,
- the maskable entry is the same square asset, so Android will crop the logo
  inside the safe zone rather than fill it.

This is a design task. It is also the first thing a store reviewer and a user
both see.

### `appleWebApp` metadata is absent

`grep -rn "appleWebApp\|apple-mobile-web" src` returns nothing. With
`display: standalone` in the manifest, modern iOS still honours Add-to-Home-Screen,
so this is not fatal — but `apple-mobile-web-app-status-bar-style` is how the
notch area is coloured in an installed PWA, and without it the app-shell top edge
is the browser default rather than the brand. Low severity, one-line fix in
`src/app/[lang]/layout.tsx`'s `metadata`.

---

## 4. Seam 3 — safe areas

The bottom edge is handled correctly and consistently. Every fixed bottom
surface carries the inset:

| Surface | File:line |
|---|---|
| Customer tab bar | `src/components/bottom-nav.tsx:76` |
| Merchant tab bar | `src/components/merchant-tab-bar.tsx:57` |
| Product buy bar | `src/components/product-buy-bar.tsx:53` |
| Order sticky actions | `src/components/order-sticky-actions.tsx:40` |
| Bottom sheet | `src/components/ui/bottom-sheet.tsx:92` |
| Site layout spacer | `src/app/[lang]/(site)/layout.tsx:99` |
| Merchant layout spacer | `src/app/[lang]/(dashboard)/merchant/[storeId]/layout.tsx:272` |

The **top** edge is handled in exactly one place:

```
src/components/site-header.tsx:38   pt-[env(safe-area-inset-top)]   ← customer header
src/app/[lang]/(dashboard)/layout.tsx:84   (no inset)               ← merchant/admin header
```

With `viewportFit: cover` set globally (`src/app/[lang]/layout.tsx:64`), the
viewport extends under the status bar. The customer header compensates. **The
merchant and admin header does not** — so on a notched phone, in an installed
PWA or in the Capacitor shell, the merchant's header content sits under the
status bar and the notch.

It compounds one line down: `src/components/merchant-sidebar.tsx:273` pins the
mobile module strip at `sticky top-16` — a hardcoded 64px that assumes a header
of exactly `h-16` and **no** safe-area inset. Where the inset exists (≈47–59px on
a modern iPhone), the strip will sit ~50px too high and tuck under the header.

Note that the Capacitor iOS config sets `contentInset: "always"`
(`capacitor.config.ts:26`), which insets the WebView below the status bar — so
inside the iOS binary the inset is 0 and the bug is invisible. It appears in the
**installed PWA** and on **Android**, which is the larger share of the Lebanese
market.

This is a real, specific, testable defect and it lives on the merchant's side —
the side that opens the app twenty times a day.

---

## 5. Seam 4 — the offline story is told twice

Two offline surfaces now exist:

1. `public/offline.html`, served by `sw.js:71–73` when a navigation fails.
2. `native-shell/index.html`, the Capacitor `webDir` fallback shown before the
   remote origin loads.

They are different documents with different copy and different visual
treatment. In the binary, which one a user sees depends on *when* the network
failed — before the WebView reached the origin (native shell) or after
(service-worker offline page). Same failure, two faces.

Not urgent at 11 stores. Worth one decision: make `native-shell/index.html`
visually identical to `offline.html`, or make it a pure splash with no message,
so there is only one thing a user can be shown when the network is gone.

### The service worker itself

`public/sw.js` is well-judged and the reasoning is written into the file. Two
notes rather than complaints:

- The `NEVER_CACHE` predicate is `url.pathname.includes(p)` (`sw.js:52–57`), not
  a prefix test. That is deliberately loose and errs toward *not* caching, which
  is the safe direction. It does mean a public store whose slug happens to
  contain `orders` is excluded from asset caching — harmless.
- The fetch handler calls `respondWith` only for navigations and for static
  assets (`sw.js:69`, `:79`). Everything else falls through to the network
  untouched, including RSC payload requests. Correct.
- `CACHE = "matjar-shell-v1"` (`sw.js:6`) is a manual version string. There is no
  build step that bumps it, so a change to `offline.html` will not reach users
  who already have v1 installed until someone edits the constant by hand. Worth
  deriving it from the build id.

---

## 6. The merchant mobile shell against sector-adaptive navigation

`src/lib/sectors.ts` defines **17 sectors**, each with a `daily` module list.
`MerchantTabBar` (`src/components/merchant-tab-bar.tsx`) takes `tabs` as a prop
and derives icons from `OS_MODULE_META` (`:38–43`), with the drawer demoted to
overflow behind المزيد (`:95`). The tabs are computed by
`merchant-sidebar.tsx:299` and rendered only below `lg` (`:57`).

**This is the right architecture and the prior audit was right to build it.**
Three observations on top.

### 6.1 The sector-adaptive claim is real for `daily`, and false for everything else

Every one of the 17 sectors declares the **identical** `people` group —
`customers, campaigns, automations, staff, hr` (`sectors.ts:191, 204, 217, 230,
243, 259, 272, 285, 298, 311, 324, 337, 350, 363, 376, 389, 402`). `money` takes
one of two values. `store` is a single shared constant (`sectors.ts:172`).

So a hotel and a butcher get a genuinely different العمليات tab and a genuinely
different الكتالوج tab, and then an identical everything-else. That is fine — but
it means "sector-adaptive navigation" is currently a claim about **one tab**, not
about the shell. Stating it accurately matters when the next sector is added.

### 6.2 The `doctors` module is doing five jobs under one name

`sectors.ts` routes the `doctors` module — icon `Stethoscope`
(`OS_MODULE_META`) — into `beauty` (`:271`), `fitness` (`:284`), `education`
(`:310`), `petCare` (`:362`) and `professional` (`:375`), as the generic
"team/provider" screen. A hairdresser's staff roster is labelled with a
stethoscope. `sectorHasTeam()` (`sectors.ts:438`) already knows this concept is
"team", not "doctors".

This is exactly the kind of thing that erodes a merchant's trust in a
multi-sector product: it tells them the software was built for someone else.
Renaming the module key is a migration; renaming its **label and icon per
sector** is a lookup table and costs nothing.

### 6.3 Ten of 17 sectors get a tab bar with an empty slot

The prior audit's rule was "no empty tab is ever rendered" and the fallback is
الرئيسية · المزيد only. Reading the `daily` lists, the sectors whose first two
daily modules do not cleanly split into an operations inbox and a catalogue are
the ones to check on a device — `sportsCourts` (`bookings, resources, tasks`),
`events` (`tickets, items, tasks`), `professional` (`requests, bookings,
doctors, tasks`). Whether the tab bar degrades gracefully for those **cannot be
verified here** and needs one pass per sector on a phone.

### 6.4 Badge counts

`MerchantTabBar` accepts `badge` per tab (`:13`) and renders it capped at 9+
(`:73`). Whether the count is a real query or a placeholder is decided by the
caller in `merchant-sidebar.tsx` and was not traced here. The prior audit's rule
— real query only — should be re-confirmed on a device with data.

---

## 7. What the two delivery mechanisms mean for the roadmap

At 11 active stores, the binary is a **credibility asset, not a distribution
channel**: a merchant asking "do you have an app?" is asking whether Matjar is a
real company. That is a legitimate reason to ship it, and the hosted-hybrid
choice keeps the cost near zero.

But shipping it in its current state costs more than it earns:

1. Push permission asked and never honoured (§2) — burns a one-shot iOS prompt.
2. Deep links declared and unverifiable (§3) — every link out of the app fails
   to come back into it, which is the single behaviour that makes an app feel
   installed.
3. Icons that are one square asset in three declarations (§3) — visible in the
   store listing, the launcher and the task switcher.
4. Apple guideline 4.2: `MOBILE_APP.md` argues the app passes because it has
   push, location and camera. Push does not deliver. That argument is currently
   two-thirds true.

**Sequence:** fix §2 (one line, today) → generate real icon assets → host the two
`.well-known` files → then submit. Not the other way round.

---

## 8. What could not be verified

- Whether Chrome offers the install prompt (needs a real device; the prior audit
  reached the same wall).
- Whether the service worker installs and serves the offline page.
- Whether the bottom sheet opens, traps focus and restores it.
- Whether the merchant tab bar renders correctly for any of the 17 sectors.
- Whether the safe-area defect in §4 actually clips content — the geometry
  argument is sound but the pixel result needs a notched device.
- Anything about the iOS binary at all: it has never been built (the repo was
  scaffolded on Windows; `MOBILE_APP.md` says a Mac or cloud macOS CI is
  required).
- Frame rates, transitions, scroll feel, keyboard behaviour.
