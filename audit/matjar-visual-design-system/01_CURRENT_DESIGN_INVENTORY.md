# 01 — Current Design Inventory

Extracted from the repository, not assumed.

## Stack

| Item | Value |
|---|---|
| Framework | Next.js **16.2.9** (App Router, route groups `(site)` / `(dashboard)`) |
| React | **19.2.4** |
| Styling | **Tailwind CSS 4** — CSS-first config via `@theme inline`, no `tailwind.config.js` |
| Language | TypeScript 5 |
| Icons | `lucide-react` 1.22 |
| Backend | Supabase JS 2.109 |
| Native shell | Capacitor 8.4 |
| Tests | **Vitest 4.1** — no Playwright, no visual-regression tooling |
| Scripts | `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `cap:*` |

**Single stylesheet:** `src/app/globals.css` (410 lines). No CSS modules, no styled-components, no second styling system.

## Token layer

Defined on `:root`, exposed to Tailwind through `@theme inline`.

**Surfaces** — `--background` `#fbfbf9` (warm off-white), `--surface` `#ffffff`, `--surface-muted` `#f4f5f3`
**Text** — `--foreground` `#0b1620` (slate ink), `--muted-foreground` `#5d6b72`
**Brand** — `--primary` `#1556c2`, `--primary-hover` `#0f4499`, `--primary-foreground` `#ffffff`, `--primary-soft` `#e9f1fd`
**Accent** — `--accent` `#f59e0b` (amber, used for ratings/offers), `--accent-soft` `#fef3c7`
**Lines** — `--border` `#e8e8e2`, `--ring` `#1556c2`
**Semantic** — `success` / `warning` / `danger` / `info`, each with a `-soft` tinted pair

The semantic values carry inline comments recording the contrast ratio each was tuned to hit — e.g. `--danger: #b91c1c; /* darkened for AA text on --danger-soft (5.7:1) */`. Measured light-theme contrast confirms these hold.

**Shadows** — five-step scale (`xs`→`xl`), each a layered pair (tight near-shadow + wider ambient), tinted to the slate ink rather than pure black.
**Motion** — `--ease-out-back: cubic-bezier(0.22, 1, 0.36, 1)`; a CSS-only `data-animate` entrance with stagger, guarded by `prefers-reduced-motion`.
**Radius** — `--radius-xl: 1rem`, `--radius-2xl: 1.25rem`.

## Dark theme

Token-value overrides only — every component styled through tokens adapts automatically. Applied two ways:

1. `@media (prefers-color-scheme: dark)` scoped to `:root:not([data-theme="light"])` — OS preference, unless the user forced light
2. `:root[data-theme="dark"]` — explicit toggle

Palette: `--background` `#0d1117`, `--surface` `#161b22`, `--foreground` `#e6edf3`, `--muted-foreground` `#9198a1`, `--primary` `#4c8dff`.

`ThemeToggle` (`src/components/theme-toggle.tsx`) writes `data-theme` to `<html>` and persists to `localStorage` under `matjar-theme`; a no-flash inline script in the root layout applies the stored choice before paint. Confirmed working at runtime.

## Typography

`next/font/google`, loaded in `src/app/[lang]/layout.tsx`:

- **Tajawal** → `--font-sans`, body text, covers Arabic and Latin
- **Alexandria** → `--font-display`, headings only

A deliberate two-face pairing chosen for Arabic-first rendering — not a Latin default with Arabic fallback.

## Shared UI library — `src/components/ui/` (14 primitives)

```
badge · button · card · confirm-dialog · container · empty-state
field · page-header · page-hero · progress · skeleton · sparkline
stat · tabs
```

`Badge` variants: `neutral · primary · success · warning · danger · info`; sizes `sm · md`.
`Field` supports `label / hint / error` and is the standard form wrapper.

**Gaps against the brief's component list:** no Toast, Modal/Drawer (only `confirm-dialog`), Table, Pagination, Select-as-primitive, Switch, Date/Time picker, Breadcrumb, or Chart container primitive. These exist as ad-hoc per-page markup — which is where much of the 212-instance hardcoded-colour debt lives.

## Storefront themes (separate system)

`src/lib/themes.ts` + `[data-sf]` CSS: five complete storefront design systems (`classic / minimal / warm / bold / luxe`) that merchants select, with merchant accent and layout choices overriding. This is a second, intentional theming layer scoped to store pages — distinct from the light/dark app theme.

## Surface inventory

**127 `page.tsx` routes.** Public `(site)` routes include:

```
/ · explore · categories · category/[slug] · search · map · store/[id] · [handle]
product/[id] · p/[slug] · offers · flash · clearance · best-sellers
market · market/[id] · market/new · market/[id]/edit
freelance(+/[id],/mine,/new) · jobs(+/[id],/mine,/new) · wholesale(+/[id],/mine,/new)
u/[id] · account · orders(+/[id]) · track/[orderId] · bookings · favorites · following
wishlist · messages(+/[id]) · notifications · delivery
hub · hub/academy(+/[slug]) · hub/leaders(+/[slug])
merchants · pricing · about · trust · help · contact · privacy
```

Plus `(dashboard)` merchant and admin trees (not runtime-audited — auth required).

## RTL / i18n

`dir` and `lang` set on `<html>` per locale; verified `dir="rtl" lang="ar"` at runtime. Logical properties (`ms-*`, `me-*`, `start-*`, `end-*`) are used in the components inspected, and `rtl:rotate-180` handles directional icons. Dictionaries `ar.json` / `en.json` are kept at strict key parity (3134 keys, verified by a diff script each change).

## Assessment

This is a **mature, coherent design system**, not a codebase awaiting one. The task is convergence — bringing the dashboard back onto the tokens and closing the primitive gaps — not extraction or replacement.
