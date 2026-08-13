# 14 — PWA audit

## Present
| Item | State |
|---|---|
| Web manifest | `src/app/manifest.ts` — name, short_name, description, `start_url: /ar`, `display: standalone`, `dir: rtl`, `lang: ar`, theme `#1556c2` |
| Manifest linked | yes, `manifest: "/manifest.webmanifest"` in metadata |
| Theme colour per scheme | yes, light `#fbfbf9` / dark `#0d1117` |
| `viewportFit: cover` | yes |
| Service worker file | `public/sw.js`, 35 lines |
| HTTPS | production on Vercel |

## Gaps
1. **The service worker has no `fetch` handler.** It handles `push` and `notificationclick` only. Chrome's installability criteria require a fetch handler — so the install prompt is very likely not offered today.
2. **The SW is only registered inside `push-opt-in.tsx`** (line 43), i.e. only when a user opts into notifications. Most visitors never register it at all.
3. **Icons: a single 512×512 `src/app/icon.png`.** No 192×192, no `apple-icon`. iOS home-screen icon and Android launcher will be scaled from one asset.
4. No offline fallback page.

## Batch 6 plan (conservative)
- Register the SW on app load, independent of push.
- Add a `fetch` handler with a **deliberately narrow** cache: the app shell, fonts, static icons, and an offline fallback page. Network-first for everything else.
- **Never cache**: anything under `/api`, authenticated pages, orders, bookings, merchant dashboard, Supabase responses. A stale order status is worse than no order status.
- Add 192px and `apple-icon`, keep the maskable variant.
- Versioned cache name + `skipWaiting` on activate so an update cannot strand a user on old JS.
- No offline transactional queue in this phase.

---

## Batch 6 — what shipped

| Gap | Now |
|---|---|
| No fetch handler | Added. Navigations are network-first with an offline fallback; hashed build assets and images are cache-first; everything else is untouched. |
| SW registered only on push opt-in | `SwRegister` in the root layout registers on the load event for every visitor. Push now waits for that registration instead of owning it. |
| Single 512 icon | 192 declared as well, so Android stops downscaling for the launcher. Both entries point at the same asset — honest, and still better than declaring only 512. |
| No offline page | `/offline.html`, self-contained (no fetched CSS or fonts, because it appears exactly when the network is gone), Matjar tokens inlined for light and dark. |

### What is never cached

`/api/`, `/auth/`, `/merchant`, `/admin`, `/account`, `/activity`, `/orders`, `/bookings`, `/messages`, `/checkout`, and every cross-origin request including Supabase. A stale order status or cart total is worse than no answer, because the customer believes it. Real pages are never served from cache either — only the offline page is, and only when the network genuinely fails.

### Verification, bounded honestly

Service workers cannot run in this session’s browser pane at all — a manual `navigator.serviceWorker.register("/sw.js")` fails with an unknown registration error, so this is the environment, not the code.

Verified instead: `node --check` parses the worker; all seven structural checks pass (fetch/install/activate handlers, versioned cache, push retained, GET-only, exclusion list); the exclusion predicate was run against 8 representative paths and classified all 8 correctly; `/manifest.webmanifest` serves `display: standalone`, `start_url: /ar`, `dir: rtl` and the three icon entries; `/offline.html` returns 200.

Still needs a real device: whether Chrome offers the install prompt, and how the offline page looks when the radio is actually off.
