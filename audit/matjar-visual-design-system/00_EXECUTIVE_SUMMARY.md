# Matjar — Visual & Design System Audit
## Checkpoint 0 — Executive Summary

**Date:** 2026-07-30
**Branch:** `main` (working tree clean at audit start, commit `e9b29a5`)
**Method:** instrumented runtime measurement (computed CSS in a live browser) + exhaustive static analysis of the repo. **No application code was modified.**

---

## The headline finding

**The premise that Matjar needs a design system extracted or rebuilt is wrong. One already exists, and it is measurably in good shape.**

The brief assumed we would "extract the design system from the code" and fix a generic AI-looking UI. What the measurements actually show:

| Metric | Measured result | Verdict |
|---|---|---|
| Contrast failures (light theme) | **0** across 4 routes × 2 widths | Passes WCAG AA |
| Contrast failures (dark theme, applied correctly) | **0** | Passes WCAG AA |
| Horizontal overflow | **0px** on every route/width tested | Clean |
| `<h1>` per page | **exactly 1** everywhere | Correct semantics |
| Images missing `alt` | **0** | Clean |
| Design tokens | Full set: surfaces, text, brand, semantic status, shadows, easing | Mature |
| Dark mode | Token-level, OS-preference + explicit toggle, no-flash script | Correctly built |
| Typography | Tajawal (body) + Alexandria (display), Arabic-first | Deliberate |

The token layer is not merely present — it is *tuned*. The light-theme semantic colours carry comments documenting the exact contrast ratio each value was darkened to achieve (e.g. `--success: #0b7a35; /* darkened for AA text on --success-soft (4.9:1) */`). That is the work of someone who already did this properly.

**Therefore this audit's recommendation is not a redesign.** It is a short list of specific, high-leverage defects, plus a decision about visual direction that is genuinely open.

---

## Two false positives I caught and corrected

Reporting these because they materially changed the conclusion, and because an audit that hides its own errors is not trustworthy.

**1. "Catastrophic contrast failures" — was a measurement bug.**
My first pass reported 8–12 contrast failures per page in light mode, including text at 1.15:1. Root cause: Tailwind 4 emits colours in modern CSS colour syntax (`oklab()` / `oklch()`). My regex-based colour parser read `oklab(0.176 -0.003 -0.014 / 0.8)` and took the first three numbers as RGB — turning a near-white background into near-black. Fixed by resolving every colour through a canvas pixel read, which handles any valid CSS colour syntax. **Corrected result: 0 failures.**

**2. "Dark mode is 4× worse (26–31 failures)" — was a test-method artifact.**
I set `data-theme="dark"` on the document *after* the page had loaded and hydrated. That produced a mixed state — backgrounds flipped to dark tokens while some text kept light-theme values — which no real user ever encounters. When the theme is applied the way the app actually applies it (`localStorage` → no-flash inline script before paint), the measured result is **0 contrast failures**. The dark theme is clean.

The lesson generalises: **an audit finding that has not been reproduced through the real user path is not a finding.**

---

## What is genuinely wrong

Three real defects, ranked by leverage:

### 1. Footer link tap targets — 20px tall (Critical, affects all 127 routes)
Footer navigation links render at **20px height** against a 44px minimum. 29–34 interactive elements per page fall under the threshold, and the same set repeats on every page because they live in the shared footer.

- Measured: `للتجّار` 31×20, `المتاجر` 38×20, `الجملة` 38×20, `الأسعار` 44×20, `من نحن` 44×20
- Cause: `src/components/site-footer.tsx:113` — `className="text-sm text-muted-foreground …"` with no vertical padding
- **One line fixes every footer link on every page.**

### 2. Unlabelled form inputs on `/ar/market` (High)
**7 inputs** with no accessible name (no `aria-label`, no `<label for>`, not wrapped in a label). Screen-reader users cannot tell what these filters do. One more on the homepage/explore search field.

### 3. 212 hardcoded palette colours bypassing the token system (High — consistency debt)
`bg-blue-600`, `text-emerald-500`-style raw Tailwind palette classes appear **212 times** across the codebase, concentrated in the merchant dashboard and admin pages. These do not respond to the dark-mode token flip and are the single largest threat to visual consistency as the product grows.

Worst offenders: `(dashboard)/layout.tsx`, `merchant/page.tsx`, `merchant/[storeId]/{accounting,automations,campaigns,reports,subscription}`, `(site)/{bookings,delivery,offers,merchants}`, `hub/{page,leaders}`.

Also present: 30 raw hex values and 22 inline `style={{…}}` blocks in TSX.

---

## Where the real opportunity is

The public marketplace is visually solid. **The gap is between the marketplace and the dashboard.** The 212 hardcoded colours are overwhelmingly in merchant/admin surfaces — meaning the Business OS, which is Matjar's actual differentiator, is the part that drifted from the design system.

That reframes the priority. Not "redesign the marketplace," but **"bring the Business OS up to the standard the marketplace already meets."**

---

## Recommendation

1. **Do not run a platform-wide redesign.** The foundation is sound; a rewrite would risk regressions for cosmetic gain.
2. **Fix the three measured defects** — roughly a day's work, and #1 and #2 are accessibility-blocking.
3. **Pick a visual direction** (see `03_VISUAL_DIRECTIONS.md`) — this is the one genuinely open question, and it concerns the dashboard more than the storefront.
4. **Then converge the dashboard onto the tokens**, page by page, using the 212-instance list as the worklist.

Full measured data: `02_MEASURED_AUDIT.md`. Issue list: `04_FINDINGS.csv`.

---

## Blockers encountered

- **Screenshots unavailable.** The in-app browser pane was not displayed, so the page did not composite frames and every screenshot request timed out. All findings here come from computed-style measurement and static analysis instead — which is *more* precise for contrast, sizing, and overflow, but does not substitute for human judgement on composition and visual appeal. **Visual-appeal claims in this audit are therefore deliberately limited to what the numbers support.**
- **No Playwright installed** (only Vitest). Automated visual-regression baselines cannot be created without adding a dependency, which Checkpoint 0 rules prohibit. See `05_ROADMAP.md` for the proposed approach.
- **Dashboard and admin routes were not measured at runtime** — they require authentication, and the iframe harness redirects to login. Their defects here come from static analysis only.
