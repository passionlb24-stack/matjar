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
