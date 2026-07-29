# 18 — Dependency & Supply-Chain Audit

_Checkpoint 0. Read-only: `package.json`, `package-lock.json`, `npm ls --depth=0`, `npm outdated`. No installs, no `audit fix`._

## Verdict: clean
22 runtime deps — **all declared, all imported/used**. **None imported-but-undeclared. None declared-but-unused. None abandoned.** No known-malicious or deprecated packages. Findings are minor hygiene + one bundle-size item.

## Findings
| ID | Title | Severity | Evidence |
|---|---|---|---|
| DEP-01 | Heavy client libs statically imported in `"use client"` components → eager route-bundle bloat | Medium | `qrcode`→`hub/qr-generator.tsx:4`, `product-story-card.tsx:4`, `store-share-card.tsx:4`; `jsbarcode`→`hub/barcode-generator.tsx:4`; `leaflet`(+css, ~150KB, references `window`)→`location-picker.tsx:4`, `store-map.tsx:4` |
| DEP-02 | `next` and `react` pinned to **exact** versions → won't pick up patch releases (16.2.9→16.2.12, 19.2.4→19.2.8) that may carry security fixes | Medium | `package.json` (no `^`) |
| DEP-03 | `@types/jsbarcode` misplaced in `dependencies` (should be `devDependencies`) | Low | `package.json` |
| DEP-04 | `node_modules` drifted from lockfile — 4 extraneous WASM fallback packages (`@emnapi/*`, `@napi-rs/wasm-runtime`) | Low | `npm ls --depth=0` (harmless; `npm ci` clears) |
| DEP-05 | Minor out-of-range updates available: `lucide-react` 1.22→1.27, `@supabase/supabase-js` 2.109→2.111, `@supabase/ssr` 0.12.0→0.12.4 | Low | `npm outdated` |

### DEP-01 fix
`next/dynamic(() => import(...), { ssr:false })` for `leaflet`/`qrcode`/`jsbarcode` component wrappers keeps ~150KB+ off the initial payload of routes that embed maps/QR/barcodes.

## Recommended upgrade plan (hold majors)
| Package | Current | Target | Risk | Breaking | Priority | Testing |
|---|---|---|---|---|---|---|
| next | 16.2.9 (exact) | 16.2.12 | Low | none (patch) | High (security patches) | build + smoke |
| react/react-dom | 19.2.4 (exact) | 19.2.8 | Low | none | High | build + smoke |
| @supabase/supabase-js | 2.109 | 2.111 | Low | none | Medium | RPC smoke |
| @supabase/ssr | 0.12.0 | 0.12.4 | Low | none | Medium | auth smoke |
| lucide-react | 1.22 | 1.27 | Low | none | Low | visual |
| eslint | 9.39 | **10.x** | Med | **major — hold** | Low | full lint reconfig |
| @types/node | 20 | **26** | Low | major — hold | Low | typecheck |
| typescript | 5.9 | **7.0 (native)** | High | **major — hold** | Low | full typecheck |

**Do not upgrade during the audit.** Patch bumps for `next`/`react` (security-relevant, non-breaking) are the only near-term recommendations; batch them behind a build+smoke check.
