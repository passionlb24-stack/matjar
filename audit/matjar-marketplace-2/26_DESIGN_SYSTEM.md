# 26 — Design system

**Method.** Read `src/app/globals.css` (529 lines), all 15 files in
`src/components/ui/`, and counted idiom usage across 435 `.tsx` files. Contrast
figures are computed from the token hex values — see `25_ACCESSIBILITY_RTL.md` §2.

**Not done:** nothing was seen rendered. No visual judgement here is based on
looking at the product. Where this document says something "reads as" a certain
way, that is an inference from the classes, not an observation.

---

## 1. What the system is

`globals.css` is a genuinely thought-through token layer, and the reasoning is
written into the file rather than assumed. Three things stand out.

**The dark theme changes only values, never structure.** `:147–210` redefines the
same token names under both `prefers-color-scheme` and `[data-theme="dark"]`, so
every component styled through tokens adapts for free. The double declaration
(media query guarded with `:not([data-theme="light"])`, plus an explicit
`[data-theme="dark"]` block) is the correct three-state pattern and most codebases
get it wrong.

**Contrast was computed, not eyeballed.** `:31–48` records the ratios in
comments, and the non-obvious cases are handled: `--danger-strong` is *darker*
than `--danger` on the dark theme (`:204–206`) because `--danger` is the on-dark
*text* colour and would only give white 3.35:1 as a fill. Someone did that
arithmetic. I re-ran it; it is right.

**The type scale is tuned for Arabic first.** `:252–301`, with the reasoning at
`:255–257`: Tajawal and Alexandria carry tall ascenders and vowel marks, so the
leading is set for Arabic and reads fine in English rather than the reverse.
`clamp()` on the three largest levels handles small screens. This is the correct
direction for an Arabic-first product and it is rarer than it should be.

**Storefront themes are a real differentiator.** `:413–529` — five design systems
(`minimal`, `warm`, `bold`, `luxe`, and the default) applied via `[data-sf]` on
the store page root, each restyling four hooks (`.sf-card`, `.sf-buy`,
`.sf-price`, `.sf-announce`) without touching component markup, all token-driven
so they still adapt to light/dark. `bold` is brutalist with offset hard shadows;
`luxe` is a serif maison; `minimal` is flat editorial. This is the one place in
the app where a merchant's identity survives the marketplace's, and it is worth
more than the rest of the design system combined for merchant retention.

---

## 2. Against the brief's "generic AI design" list — honestly

The brief names four tells. Verdict on each, with counts.

### Excessive gradients — **partly true, and concentrated**

96 gradient utility occurrences across 35 files. That is not "everything is a
gradient", and most of them are legitimate: image scrims
(`store-card.tsx:50`, `store/store-hero.tsx:103` — `from-black/25 to-transparent`
over a cover photo, which is how you keep white text legible), and section washes
(`hero.tsx:54`, `ui/page-hero.tsx:27` — `from-primary-soft/70 via-background to-background`,
a soft ground fade).

Two things are not defensible:

1. **`src/components/hero.tsx:99` — gradient text.**
   `bg-gradient-to-br from-primary via-primary to-warning bg-clip-text text-transparent`
   on the home hero headline. This is the single most recognisable
   AI-design tell in the list, it is on the first screen of the marketplace, and
   it is applied to Arabic display type where the gradient runs across letterforms
   that already carry diacritics. It also cannot be contrast-checked, because the
   text has no single colour.
   **Remove it.** The brand has a display face and a confident blue; it does not
   need the headline to be iridescent.

2. **17 sector `heroTint` values are decorative gradients keyed to raw Tailwind
   palette colours** — `sectors.ts:186, 199, 212, 225, 238, 251, 267, 280, 293,
   306, 319, 332, 345, 358, 371, 384, 397`, e.g.
   `from-fuchsia-500/15 via-purple-400/10 to-transparent` for events. These sit
   outside the token system entirely (§4) and are the reason "every sector page
   has a coloured wash" is true. The *idea* — each sector reads differently — is
   good. The *implementation* should be one token per sector, not a hand-picked
   Tailwind gradient per sector.

**Verdict: not excessive overall; two specific offenders, one of them on the home
page.**

### Glassmorphism — **false as a general charge, correct as a targeted technique**

`backdrop-blur` appears in 19 files, and the list is almost entirely chrome:
`bottom-nav.tsx:76`, `merchant-tab-bar.tsx:57`, `site-header.tsx:38`,
`product-buy-bar.tsx:53`, `order-sticky-actions.tsx:40`,
`ui/bottom-sheet.tsx:92`, `ui/confirm-dialog.tsx`, `merchant-sidebar.tsx:312`.

Every one of those is a **fixed bar or overlay that content scrolls under**.
Blur-behind is the correct native pattern there — it is what iOS and Android both
do — and the translucency values are conservative (`bg-surface/95`, five uses;
`bg-surface/90`, five). Content cards are opaque.

`merchant-cta.tsx:16, 20` uses two decorative `bg-white/10` + `blur-2xl` orbs.
That is the only genuinely decorative glass in the app, and it is one component.

**Verdict: false. This is disciplined use, not a style.**

### Everything in rounded cards — **true, and it is the strongest of the four charges**

Rounding counts across all `.tsx`:

| class | count |
|---|---|
| `rounded-xl` | 506 |
| `rounded-2xl` | 385 |
| `rounded-lg` | 305 |
| `rounded-full` | 248 |
| `rounded-3xl` | 39 |
| `rounded-none` | **13** |

Thirteen deliberate square corners in a 435-file application. Nothing in this
app has an edge.

And the card is the universal container. `ui/card.tsx` defines it as
`rounded-2xl border border-border bg-surface` plus a shadow variant. That
primitive is imported in **40 files**. The literal string
`rounded-2xl|rounded-xl border border-border bg-surface` appears **339 times**.

So the card is not just the dominant layout unit — it is the dominant layout unit
*copied by hand*, nine times more often than it is used as a component.

**Why it matters beyond aesthetics.** When every element is a bordered rounded
box, the box stops carrying information. A card should mean "this is a discrete
thing you can act on". At 339 hand-rolled instances it means "this is a div". The
customer loses the ability to scan for what is tappable, which is exactly the
skill a marketplace depends on.

**Verdict: true.** This is where Matjar most looks like a generated interface.
The fix is not "fewer rounded corners" — it is *fewer containers*. Lists of
related items (activity rows, order rows, inventory rows) should be **one** card
containing hairline-separated rows, not N cards. `activity-list.tsx:90–99` is the
clearest example: a `space-y-3` list where every row is its own
`rounded-2xl border bg-surface p-4`.

### Excessive shadows — **false**

| class | count |
|---|---|
| `shadow-sm` | 98 |
| `shadow-md` | 50 |
| `shadow-xs` | 33 |
| `shadow-lg` | 16 |
| `shadow-xl` | 5 |
| `shadow-2xl` | 1 |

The distribution is correctly weighted to the subtle end, and the tokens
themselves (`globals.css:87–91`) are two-layer — a tight near-shadow plus a wide
ambient one — tinted to the slate ink rather than pure black. `Card` defaults to
`shadow-xs` (`ui/card.tsx:11`). One `shadow-2xl` in the entire app.

**Verdict: false. This is restrained.**

---

## 3. The tokens added by the mobile pass are used nowhere

`globals.css:96–105` defines five mobile metric tokens with a comment explaining
why they exist — *"named once so sticky bars, sheets and page gutters stop
guessing at each other"*:

```
--m-page-x: 1rem;
--m-header-h: 3.5rem;
--m-tabbar-h: 3.5rem;
--m-sticky-gap: 0.75rem;
--m-touch: 2.75rem;
```

**Usage across `src/**/*.tsx`: zero. All five.**

Every sticky bar hardcodes its own literal instead:
`bottom-nav.tsx:89` `h-14` · `merchant-tab-bar.tsx:79` `h-14` ·
`product-buy-bar.tsx:53` `bottom-14` · `order-sticky-actions.tsx:40` `bottom-14` ·
`(site)/layout.tsx:99` `h-[calc(3.5rem+env(safe-area-inset-bottom))]` ·
`merchant/[storeId]/layout.tsx:272` `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` ·
`merchant-sidebar.tsx:273` `top-16`.

And one of them is **wrong**: `--m-header-h: 3.5rem` (56px) does not match the
actual header, which is `h-16` (64px) in both
`src/components/site-header.tsx:39` and
`src/app/[lang]/(dashboard)/layout.tsx:85`.

So the tokens are unused *and* one carries a false value — which is the worst
combination, because the next person who adopts them will produce a layout bug
and blame themselves. The concrete consequence of the hardcoding is already
visible: `merchant-sidebar.tsx:273` pins the mobile module strip at `top-16`
with no safe-area allowance, while the dashboard header itself has no
`pt-[env(safe-area-inset-top)]` at all (see `18_MOBILE_APP_EXPERIENCE.md` §4).

**Fix:** correct `--m-header-h` to `4rem`, then adopt all five mechanically.
This is the exact class of change that is safe to do in bulk and pays back on
every future sticky surface.

---

## 4. Token discipline: the system is not enforced

**196 raw Tailwind palette classes across 42 files** — `bg-emerald-600` (16),
`bg-emerald-700` (13), `bg-amber-500` (11), `text-amber-700` (10), `bg-amber-600`
(7), `bg-red-600`, `border-red-500`, `bg-zinc-200`, `text-slate-500`, and 30-odd
gradient stops.

Three of these are inside the primitives themselves, which is where it hurts most:

| File:line | Class | Should be |
|---|---|---|
| `ui/button.tsx:33` | `bg-red-600 text-white` (the `danger` variant) | `bg-danger-strong text-danger-strong-foreground` |
| `ui/field.tsx:18` | `border-red-500 focus:ring-red-500/15` | `--danger` |
| `ui/field.tsx:45, 54` | `text-red-600` | `--danger` |

`--danger-strong` and `--danger-strong-foreground` exist precisely for this
(`globals.css:41–46`, with a comment explaining that `--danger` is tuned for
text-on-soft and `--danger-strong` for fill-under-white). The Button ignores
them. So the app's destructive action does not change between light and dark,
while everything around it does.

Most of the rest is defensible in isolation and indefensible in aggregate:
the amber family is a hand-rolled second accent for the Hub/Leaders surfaces
(always paired with a `dark:` variant, so it does adapt — checked), and the
emerald family is the WhatsApp CTA (which fails contrast at 3.77:1 — see
`25_ACCESSIBILITY_RTL.md` §2).

Genuinely non-adaptive: `bg-zinc-200 text-zinc-600` status chips in
`market-city-manager.tsx:244`, `market-region-manager.tsx:226`,
`my-listings-manager.tsx:24`. `hub/invoice-generator.tsx` uses hardcoded slate
throughout, which is **correct** — it renders a printed document on white paper
and must not follow the app theme.

**Fix:** an ESLint rule banning raw palette colours outside an allow-list
(`invoice-generator`, the sector tints once they are tokenised). This is the same
shape of gate recommended for `SECURITY DEFINER` revokes in
`23_SECURITY_PRIVACY.md` §2, and for the same reason: the convention exists and
only enforcement makes it real.

---

## 5. Primitive adoption, measured

| Primitive | Imported in | Hand-rolled equivalent |
|---|---|---|
| `ui/card` | 40 files | **339** literal `rounded-*xl border border-border bg-surface` |
| `ui/button` | 85 files | ~72 hand-rolled button-shaped class strings |
| `ui/badge` | 40 files | ~45 hand-rolled `rounded-full bg-*-soft px-*` pills |
| `ui/field` | 44 `<Field>` usages | `fieldClass` exported and copied; 64 orphaned labels (`25_ACCESSIBILITY_RTL.md` §6) |

Every one of these primitives carries a comment saying it exists to replace the
ad-hoc version — `card.tsx:3–6`, `badge.tsx:3–6`, `field.tsx:4–10`. Each
migration is roughly half done, and each stalled at the same place: the merchant
dashboard, where the forms and lists are longest.

**The consequences are not cosmetic.** They are already documented elsewhere in
this audit and every one traces back to a bypassed primitive:

- `Badge` has no `accent` variant → five components hand-rolled an amber pill →
  1.21:1 contrast in dark mode (`25_ACCESSIBILITY_RTL.md` §2).
- `Field` was copied as `fieldClass` → 64 controls with no accessible name.
- `Button` has no `whatsapp` variant → eight green CTAs at four different heights
  (`16_CUSTOMER_EXPERIENCE.md` §3.3).

The pattern is consistent: **the primitive lacks one variant, so the caller
leaves the system, and everything the system guaranteed is lost at once.** The
lesson is to add the missing variants before pushing adoption.

---

## 6. Money formatting — 23 copies of one function

`src/lib/currency.ts:6–10` defines `formatUsd` and its own comment calls it the
*"single source of truth; replaces the ad-hoc formatPrice copies across pages."*

| | count |
|---|---|
| Files importing `formatUsd` | **4** (`orders/[id]`, `deal-of-the-day`, `gig-card`, `product-story-card`) |
| Files defining their own local `formatPrice` | **23** |
| Inline `` `$${…}` `` interpolations | 20+ |

Most of the 23 copies are byte-identical to `formatUsd`. Some are not:
`activity-list.tsx:138` uses `` `$${it.total.toFixed(2)}` ``, so the **same order
total** renders as `$45.00` on `/activity` and `$45` on `/orders`. A customer
comparing the two screens sees two numbers.

`invoice/page.tsx:16` and `pos/page.tsx:22` use a third form
(`toFixed(2)` + `toLocaleString`), which is right for an invoice and wrong to
have arrived at independently.

Related: `.text-money` — the class that makes money tabular and bidi-isolated
(`globals.css:305–310`) — is applied in **two** files. See
`25_ACCESSIBILITY_RTL.md` §7.

**Fix:** delete the 23 copies, export a second `formatMoney(n, {decimals})` from
`currency.ts` for the invoice/POS case, and apply `.text-money` at the same time.
This is one mechanical pass and it closes a design consistency issue, an RTL
issue and a correctness issue together.

---

## 7. Gaps in the primitive set

`src/components/ui/` is 15 files, 1,132 lines. Missing, and each absence explains
a specific duplication found elsewhere in this audit:

| Missing | Consequence found |
|---|---|
| `Switch` / `Toggle` | three hand-rolled toggles with `bg-white` knobs — `automation-list-item.tsx:107`, `crm-manager.tsx:772`, `modules-manager.tsx:86` |
| `Table` / `DataList` | merchant lists rebuilt per manager; `25_ACCESSIBILITY_RTL.md` §6's orphaned labels cluster in exactly these files |
| `Toast` | `notifyError`/`notifySuccess` exist as functions but not as a primitive |
| `Chevron` (direction-aware) | 77 `rtl:rotate-180` sites, 4 of them backwards (`25_ACCESSIBILITY_RTL.md` §4) |
| `ChipRail` / `SegmentedControl` | proposed in the prior audit's `05_MOBILE_DESIGN_SYSTEM.md`, never built; `activity-list.tsx:50–74` and `explore-client` each hand-roll one |
| `Money` | 23 `formatPrice` copies, `.text-money` used twice |
| `Accent` badge variant | 1.21:1 in dark mode across five components |
| `WhatsApp` button variant | eight CTAs, four heights, failing contrast |

`ChipRail` and `SegmentedControl` are notable: the prior audit specified both,
Batch 2 shipped the *behaviour* (the chip rail on `/explore`, the segment rail on
`/activity`) without extracting the *component*. That is how the divergence
starts.

---

## 8. Ranked findings

| # | Finding | Severity | Effort |
|---|---|---|---|
| 1 | `Card` hand-rolled 339 times vs 40 uses; everything is a bordered box | high | large, mechanical |
| 2 | `Badge` has no `accent` variant → 1.21:1 in dark mode in 5 components | high | small |
| 3 | Five `--m-*` mobile tokens unused, and `--m-header-h` is wrong (56 vs 64px) | high | small |
| 4 | 23 local `formatPrice` copies; two render the same total differently | medium | mechanical |
| 5 | `ui/button` `danger` and `ui/field` errors use raw `red-*`, ignoring `--danger-strong` | medium | 3 lines |
| 6 | Gradient text on the home hero (`hero.tsx:99`) | medium | 1 line |
| 7 | 196 raw palette classes, no lint gate | medium | rule + cleanup |
| 8 | 17 sector `heroTint`s are raw-palette gradients outside the token system | medium | tokenise |
| 9 | 8 primitives missing; each absence maps to a live defect | medium | incremental |
| 10 | `.text-money` applied in 2 of ~25 money sites | medium | mechanical |
| 11 | 13 `rounded-none` in 435 files — no shape vocabulary | low | design decision |

## 9. Summary judgement

Matjar's design system is **better than its adoption**. The tokens are
well-reasoned, the contrast work is real, the type scale is Arabic-first, the
dark theme is structurally correct, and the storefront themes are a genuine
product asset. Against the brief's four "generic AI design" tells it is innocent
on two (glassmorphism, shadows), partly guilty on one (gradients — two specific
offenders), and clearly guilty on one (everything in rounded cards).

The real problem is not the system's design. It is that **the system is optional**.
Four primitives exist and are bypassed hundreds of times; five tokens exist and
are used zero times; one formatter exists and has 23 copies. Every accessibility
and consistency defect in this audit traces to a bypass, not to a bad decision.

The highest-leverage work is therefore not new design. It is **two lint rules and
four missing variants.**

## 10. What could not be verified

- Whether anything actually looks the way this document infers.
- Whether the five storefront themes render coherently, in either theme, in RTL.
- Whether the shadow tokens read as intended on an OLED phone in sunlight.
- Whether the 339 hand-rolled cards are visually identical to `ui/card` or
  quietly divergent in padding and radius — that needs a rendered comparison.
