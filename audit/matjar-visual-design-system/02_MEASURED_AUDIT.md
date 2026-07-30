# 02 — Measured Audit (raw results + methodology)

Everything here is measured, not impression. Where I could not measure, I say so.

---

## Methodology

A harness was injected into the running dev server (`localhost:3000`). It loads each route into a hidden iframe at a fixed viewport, waits 1.2s for hydration and layout to settle, then walks the DOM computing:

- **Contrast** — every element with a direct text child, resolving foreground and the nearest opaque ancestor background, against WCAG AA (4.5:1 normal, 3:1 large ≥24px or ≥18.66px bold).
- **Tap targets** — every `a / button / [role=button] / input / select / textarea`, flagged when either dimension < 44px.
- **Overflow** — `documentElement.scrollWidth - innerWidth`.
- **A11y basics** — images without `alt`, inputs without an accessible name, `<h1>` count.

**Colour resolution is done through a canvas pixel read**, not string parsing. This matters: Tailwind 4 emits `oklab()` / `oklch()`, which naive parsing corrupts (see the false positive below).

Theme is applied through the app's real path — `localStorage.setItem('matjar-theme','dark')` *before* the iframe loads — so the no-flash inline script applies it before paint, exactly as for a real user.

---

## Results — light theme

| Route | Viewport | Contrast fails | Tap fails / total | Overflow | Inputs w/o label | `<h1>` |
|---|---|---|---|---|---|---|
| `/ar` | 390×844 | **0** | 29 / 119 | 0 | 1 | 1 |
| `/ar/explore` | 390×844 | **0** | 29 / 114 | 0 | 1 | 1 |
| `/ar/market` | 390×844 | **0** | 29 / 79 | 0 | **7** | 1 |
| `/ar/pricing` | 390×844 | **0** | 29 / 49 | 0 | 0 | 1 |
| `/ar` | 1440×900 | **0** | 34 / 119 | 0 | 1 | 1 |

Additional routes measured with the earlier (pre-fix) harness and clean on structure — `/ar/categories`, `/ar/freelance`, `/ar/jobs`, `/ar/merchants`, `/ar/hub`, `/ar/login`: overflow 0, `<h1>` 1, images-without-alt 0 on all.

## Results — dark theme (applied via the real path)

| Route | Viewport | Contrast fails | Token `--foreground` | Nav link colour | Login colour |
|---|---|---|---|---|---|
| `/ar` | 1440×900 | **0** | `#e6edf3` ✅ | `#9198a1` ✅ | `#e6edf3` ✅ |

Both themes pass AA on every route measured.

---

## Correction log — two findings I retracted

Recorded in full because both would have sent implementation in the wrong direction.

### Retracted #1 — "8–12 contrast failures per page including 1.15:1 text"

**What I reported first:** severe contrast failures on every page, worst at 1.15:1 on the app-store badges, plus nav links at 3.14–3.81:1.

**Why it was wrong:** the background colour was being read as `rgb(0.987526, 0.0007011, 0.00254703)`. Those are 0–1 floats from `oklab()`, not 0–255 bytes. My parser grabbed the first three numbers, so a near-white header background was scored as near-black, and every light-on-light pairing looked catastrophic.

**Fix:** resolve colours by painting them to a 1×1 canvas and reading the pixel — this handles `oklch`, `oklab`, `color(srgb …)`, `rgb`, hex, named colours uniformly. Verified: `oklch(0.98 0.002 106)` → `[248,248,247]`.

**Corrected result:** 0 failures.

### Retracted #2 — "dark mode is 4× worse: 26–31 failures"

**What I reported first:** dark mode collapsing, nav links at 3.14:1 and `تسجيل الدخول` at 1.04:1 — effectively invisible.

**Why it was wrong:** I set `data-theme="dark"` on the iframe's `documentElement` *after* load. That produced a state where backgrounds had flipped to dark tokens while several text colours still held light-theme values (`#5d6b72`, `#0b1620`) — dark text on a dark ground. **No real user reaches this state**, because the app applies the theme before paint.

**Verification:** re-run with `localStorage` set before load. `data-theme` applied by the app itself, `--foreground` = `#e6edf3`, nav link = `#9198a1`, login = `#e6edf3`, **contrast failures 0**.

**Corrected result:** the dark theme is clean.

---

## Confirmed defect 1 — footer tap targets

Reproduced identically on every route and both viewports, which is the signature of a shared component.

| Element | Measured | Required |
|---|---|---|
| `للتجّار` | 31 × **20** | 44 × 44 |
| `المتاجر` | 38 × **20** | 44 × 44 |
| `الجملة` | 38 × **20** | 44 × 44 |
| `الأسعار` | 44 × **20** | 44 × 44 |
| `من نحن` | 44 × **20** | 44 × 44 |

**Source:** `src/components/site-footer.tsx:113`

```
className="text-sm text-muted-foreground transition-colors hover:text-primary"
```

`text-sm` with no vertical padding gives a 20px line box. Adding vertical padding (and a negative inline margin if the visual rhythm must be preserved) raises every footer link on all 127 routes above the threshold in one edit.

The remaining sub-44px elements are the header's icon buttons at 36×36 — closer, but still under. The language pills measure 63×28.

## Confirmed defect 2 — unlabelled inputs

| Route | Inputs without accessible name |
|---|---|
| `/ar/market` | **7** |
| `/ar` | 1 |
| `/ar/explore` | 1 |
| `/ar/pricing` | 0 |
| `/ar/categories`, `/ar/freelance`, `/ar/jobs`, `/ar/hub`, `/ar/merchants`, `/ar/login` | 0 |

The market page's filter controls are the concentration. An input with no `aria-label`, no associated `<label for>`, and no wrapping label is unusable with a screen reader.

## Confirmed defect 3 — hardcoded colours (static analysis, exhaustive)

| Pattern | Count |
|---|---|
| Raw Tailwind palette classes (`bg-blue-600`, `text-emerald-500`, …) | **212** |
| Raw hex literals in `.tsx` | 30 |
| Inline `style={{…}}` | 22 |

Files carrying the most:

```
(dashboard)/layout.tsx
(dashboard)/merchant/page.tsx
(dashboard)/merchant/[storeId]/accounting/page.tsx
(dashboard)/merchant/[storeId]/automations/page.tsx
(dashboard)/merchant/[storeId]/campaigns/page.tsx
(dashboard)/merchant/[storeId]/reports/page.tsx
(dashboard)/merchant/[storeId]/subscription/page.tsx
(site)/bookings/page.tsx
(site)/delivery/page.tsx
(site)/offers/page.tsx
(site)/merchants/page.tsx
(site)/market/[id]/page.tsx
(site)/hub/page.tsx
(site)/hub/leaders/page.tsx
(site)/hub/leaders/[slug]/page.tsx
```

The concentration in `(dashboard)/` is the substantive point: **the Business OS drifted from the design system while the storefront held to it.** These classes are fixed sRGB values that do not participate in the dark-theme token flip, so each one is also a latent dark-mode defect.

---

## Not measured — and why

| Area | Reason |
|---|---|
| Merchant dashboard, admin (runtime) | Require auth; the iframe harness redirects to `/login`. Static analysis only. |
| Screenshots / visual composition | Browser pane not displayed → no frame compositing → every screenshot timed out. |
| Tablet widths (768, 1024) | Deprioritised after 390 and 1440 both returned 0 overflow and identical shared-component defects; the marginal information was low. |
| Loading / empty / error states | Need seeded fixtures or auth to reach reliably. |
| Visual regression baselines | Playwright not installed; Checkpoint 0 forbids adding dependencies. |
