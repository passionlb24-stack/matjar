# 25 — Accessibility & RTL

**Method and limits.** Static analysis of source plus arithmetic on the design
tokens. Contrast ratios below are **computed** from the hex values in
`src/app/globals.css` using the WCAG 2.x relative-luminance formula — they are
real numbers, not estimates, but they describe the *tokens*, not necessarily the
rendered pixel (a token can be overridden inline, and none of these were checked
on screen).

**Not done, and not claimable:** no screen-reader pass, no keyboard walkthrough,
no axe/Lighthouse run, no device testing, no screenshots at any viewport. The
browser pane cannot composite this application
(`audit/matjar-mobile-app-experience/18_BEFORE_AFTER.md`). Everything that needs
an eye or an ear is marked as such.

This extends `audit/matjar-mobile-app-experience/16_ACCESSIBILITY_RTL.md`. That
document listed what was present and what Batch 6 would fix. This one measures.

---

## 1. What is genuinely good

Stated first because the ratio matters when reading the rest.

| | Evidence |
|---|---|
| **Logical properties are the house standard** | 144 uses of `ms-/me-/ps-/pe-/start-/end-` against **4** physical equivalents. 59 uses of `text-start`/`text-end`, **zero** `text-left`/`text-right`. This is unusually disciplined and it is why the app works in RTL at all. |
| **Focus is visible and cannot be suppressed** | `globals.css:320–330` — element-qualified `:focus-visible` with a 2px `--ring` outline and offset, written to beat the many `outline-none` utilities. |
| **Reduced motion is honoured globally** | `globals.css:403–411`. |
| **Type floor** | 12px minimum enforced after M-007; the scale (`globals.css:258–301`) is tuned for Arabic leading first, which is the correct direction. |
| **`html` carries `lang` and `dir` from the locale** | `src/app/[lang]/layout.tsx:83–84` via `localeDirection`. |
| **The bottom sheet is a real dialog** | See §5. |
| **Semantic colour pairs were contrast-checked deliberately** | The comments in `globals.css:31–48` record the ratios. I re-computed them; they are correct. |

---

## 2. Contrast — measured

Computed from `src/app/globals.css`. AA = 4.5:1 for normal text, 3:1 for large
text and for non-text UI (WCAG 1.4.11).

### The pairs that were designed on purpose — all pass, both themes

| Pair | Light | Dark |
|---|---|---|
| `foreground` / `background` | 17.63 | 16.02 |
| `muted-foreground` / `background` | 5.32 | 6.50 |
| `muted-foreground` / `surface-muted` | 5.04 | 5.23 |
| `primary` / `surface` | 6.68 | 5.40 |
| `primary-foreground` / `primary` | 6.68 | 5.85 |
| `success` / `success-soft` | 4.93 | 6.27 |
| `warning` / `warning-soft` | 4.89 | 6.13 |
| `danger` / `danger-soft` | 5.66 | 5.02 |
| `info` / `info-soft` | 5.19 | 6.26 |

The person who wrote `globals.css:31–48` did the arithmetic and got it right,
including the non-obvious case at `:165` and `:204–206` where `--danger-strong`
had to be *darker* than `--danger` on the dark theme so white text on the fill
still clears AA. That is real craft.

### The pair nobody checked — fails, badly, and it is in production

**`--accent-foreground` on `--accent-soft`:**

| Theme | Values | Ratio |
|---|---|---|
| Light | `#7c2d12` on `#fef3c7` | **8.42** ✅ |
| Dark | `#0b1220` on `#2b2410` | **1.21** ❌ |

Near-black text on dark brown. Effectively invisible.

Used in **five** components:

| File:line | What it marks |
|---|---|
| `src/components/activity-list.tsx:117` | **"بدّو منّك شي"** — the badge telling a customer which transaction needs them |
| `src/components/flash-countdown.tsx:40` | flash-sale countdown |
| `src/components/pro-badge.tsx:5` | the Pro plan badge |
| `src/components/pro-gate.tsx:42` | the Pro upsell icon |
| `src/components/merchant-sidebar.tsx:193` | active state in the merchant drawer |

**Why this one escaped and the others did not.** `ui/badge.tsx:17–24` defines six
variants — `neutral, primary, success, warning, danger, info` — and every one of
them uses an AA-verified `-soft` pair. **There is no `accent` variant.** So every
place that needed an amber pill hand-rolled `bg-accent-soft text-accent-foreground`
outside the primitive, and outside the primitive is exactly where the contrast
discipline stopped. The design system did not fail; it was bypassed, because it
did not offer the thing that was needed.

**Also failing:** `text-accent` on `bg-accent-soft` in **light** mode —
`#f59e0b` on `#fef3c7` = **1.93**. Used at
`src/app/[lang]/(site)/flash/page.tsx:95` on an icon (needs 3:1 as meaningful
non-text content).

**Fix:** add an `accent` variant to `Badge` with a dark-theme foreground that
actually works (`--accent` itself, `#fbbf24` on `#2b2410` = 9.23), then convert
the five sites. One primitive change, five one-line edits.

### `bg-emerald-600` + white text = 3.77 — below AA for the WhatsApp CTA

`#ffffff` on `#059669`. `text-sm` is 14px, which is not "large text", so 4.5:1
applies. Used across at least eight hand-rolled CTAs — `store-products.tsx:986`,
`crafts/p/[id]/page.tsx:266`, `delivery/page.tsx:88`,
`market/[id]/page.tsx:186`, `booking-panel.tsx:608`, `join-action.tsx:84`,
`crm-manager.tsx:308` and `:408`.

This is the primary "contact the merchant" action in a marketplace with no
payment rail, so it is not a decorative failure. `bg-emerald-700` (`#047857`)
reaches 4.99. Fold it into a `Button` variant while fixing the height
inconsistency noted in `16_CUSTOMER_EXPERIENCE.md` §3.3.

### Borders — 1.19–1.42:1, and one of them is load-bearing

`--border` against both `--background` and `--surface` measures 1.19–1.42 across
both themes. For a decorative divider that is fine and intended.

It stops being fine at `src/components/ui/field.tsx:12–16`, where `border-border`
is the **only** thing marking the boundary of every input, select and textarea in
the application. WCAG 1.4.11 requires 3:1 for a control boundary that is the sole
indicator. Today an input on a Matjar form is a very faint outline.

**Fix:** a dedicated `--border-strong` token used by form controls only, so
dividers stay quiet and inputs become findable. This is a token addition, not a
restyle.

**Caveat:** `focus:border-primary` (`field.tsx:15`) means the *focused* state is
fine at 6.68. The failure is the resting state.

---

## 3. Touch targets

The prior audit closed M-006 (header hit areas) and M-011 (quantity steppers).
The pattern used — a transparent `before:` pseudo-element extending the hit area
without enlarging the visible control (`ui/button.tsx:40`) — is the right one and
should be the house rule.

`--m-touch: 2.75rem` (44px) is declared in `globals.css:104`. **It is used in
zero components** (see `26_DESIGN_SYSTEM.md` §3). Every 44px target is a literal
`h-11` written by hand.

Nine `h-8` interactive elements remain in `src/components/`. Whether each extends
its hit area with a pseudo-element was not checked one by one, and cannot be
measured from source alone — the prior audit's own experience is instructive
here: one of its four "under 44px" findings turned out to be a false positive
because the probe measured the visible box, not the effective target
(`MOBILE_ISSUES.csv`, M-006). **This needs a device pass, not another grep.**

---

## 4. RTL — chevron direction

The codebase runs **two correct conventions and one broken one**.

| Convention | Shape | Sites | Result |
|---|---|---|---|
| A | `ChevronRight` + `rtl:rotate-180` | 60 | LTR → right, RTL → left ✅ |
| B | `ChevronLeft` + `ltr:rotate-180` | ~7 | RTL → left, LTR → right ✅ |
| **C** | **`ChevronLeft` + `rtl:rotate-180`** | **5** | **LTR → left, RTL → right ❌ in both** |

Convention C sites, each checked in context:

| File:line | Purpose | Verdict |
|---|---|---|
| `src/components/activity-list.tsx:144` | drill-in on an activity card | **wrong both ways** |
| `src/app/[lang]/(site)/orders/page.tsx:100` | drill-in on an order row | **wrong both ways** |
| `src/components/breadcrumbs.tsx:45` | breadcrumb separator | **wrong both ways** |
| `src/app/[lang]/(site)/hub/page.tsx:190` | step-sequence separator | **wrong both ways** |
| `src/components/bookings-calendar.tsx:136` | "previous week" | **correct** — a back-arrow *should* point left in LTR and right in RTL |

So four real defects and one false positive. The four are all on the customer's
transaction path, which is where a wrong-facing chevron reads as "go back" on the
screen where the customer is trying to go forward.

**Fix:** convert the four to Convention A. Better: a `<DirectionalChevron>`
wrapper so the next author cannot get it wrong — 77 `rtl:rotate-180` usages is
enough repetition to justify one component.

---

## 5. Focus management in the bottom sheet

`src/components/ui/bottom-sheet.tsx` — audited line by line.

**Correct:**

| Requirement | Line |
|---|---|
| `role="dialog"` + `aria-modal="true"` | `:88–89` |
| Focus moves into the panel on open | `:43` |
| Focus is restored on close | `:38`, `:72` |
| `Escape` closes | `:46–49` |
| Tab is trapped, both directions | `:50–65` |
| Body scroll locked and restored | `:39–40`, `:71` |
| Backdrop dismiss | `:80–85` |
| Drag handle hidden from the a11y tree | `:96–99` |

That is a better dialog than most component libraries ship.

**Three real defects:**

1. **The backdrop and the close button carry the same `aria-label`.** Both use
   `title` — `:82` and `:106`. A screen-reader user tabbing the dialog hears the
   sheet's title announced as a button twice, with no indication that one
   dismisses by tapping outside. The backdrop should be `aria-hidden` with
   `tabIndex={-1}` (it is already a click target, not a keyboard one), and the
   close button should say "close", not the sheet's name.

2. **The heading is not connected to the dialog.** `:102` renders
   `<h2 className="text-h4">{title}</h2>`, and the dialog uses `aria-label={title}`
   at `:90` instead of `aria-labelledby` pointing at that `h2`. It works, but it
   duplicates the string and means the visible heading and the accessible name
   can drift.

3. **The focus trap only sees elements present when Tab is pressed** — it
   re-queries on every keypress (`:53`), which is actually the *right* choice for
   dynamic content. No defect. Noted so the next reader does not "fix" it.

**Unverifiable here:** whether any of this behaves as written. It has never been
run. `19_REMAINING_ISSUES.md` says the same. It still needs one device pass.

---

## 6. Forms

### Label association — 64 orphaned labels

Measured across all 435 `.tsx` files:

| | count |
|---|---|
| `<label>` elements | 331 |
| with `htmlFor` | 131 |
| without `htmlFor`, but wrapping their control (valid implicit association) | 136 |
| **without `htmlFor` and not wrapping a control — orphaned** | **64** |

An orphaned label is not a label. The control it sits above has no accessible
name at all unless it carries `aria-label` or a placeholder, and a placeholder is
not a name.

Verified in context — `src/components/coupon-manager.tsx:146` and
`src/components/classes-manager.tsx:114` are both
`<div><label className={labelClass}>…</label><Input … /></div>`: sibling, no
`htmlFor`, no `id`.

Concentration: `classes-manager` (7), `courses-manager` (7), `coupon-manager` (6),
`crafts/craft-services-manager` (3+), `booking-panel:1042`,
`crafts/craft-review-form:106`. Almost all merchant forms.

`ui/field.tsx` gets this right when used — 39 of 44 `<Field>` usages pass
`htmlFor`. The problem is the forms that never adopted `Field` and copied
`labelClass` instead. `field.tsx:1–8` says exactly this was the intent
("Exported so existing forms can adopt by deleting their local constant first").
The migration stalled.

**Fix:** make `htmlFor` a required prop on `Field`, then convert the six worst
managers. TypeScript then prevents recurrence.

### Group labels are not group labels

`src/components/edit-store-form.tsx:230` — `<label className={labelClass}>{dict.merchant.theme}</label>`
above a five-button theme picker. A `<label>` cannot label a group of buttons.
It should be `<fieldset><legend>` or a `role="group"` with `aria-labelledby`.
Same pattern appears wherever a label sits above a chip/segment row.

### `Field`'s required marker is invisible to assistive tech

`ui/field.tsx:44–49` renders the `*` with `aria-hidden="true"` and never sets
`required` or `aria-required` on the control. A screen-reader user is not told
the field is required until submit fails. One-line fix: thread `required` through
to the control.

### ARIA inventory

`aria-pressed` 13 · `aria-current` 11 · `aria-modal` 6 · `aria-expanded` 6 ·
`role="alert"` 5 · `aria-invalid` 3 · `aria-live` 2 · `aria-busy` 1
(programmatic, `ui/button.tsx:80`) · `aria-label` 156.

`aria-invalid` at 3 against 331 labels is the notable gap — `ui/field.tsx:73`
sets it correctly, so this is again "the primitive is right, adoption is thin".

### No skip link

`grep` finds no skip-to-content link anywhere, and `<main>` carries no `id`
(`src/app/[lang]/(site)/layout.tsx:94`,
`src/app/[lang]/(dashboard)/layout.tsx:151`). WCAG 2.4.1. A keyboard user tabs
the entire header — logo, nav links, search, notifications, avatar — on every
page before reaching content. One `<a href="#main" className="sr-only focus:not-sr-only">`
in the layout fixes it.

---

## 7. Arabic and mixed-script specifics

### `dir="auto"` is used zero times

`dir="ltr"` appears 116 times — on phone numbers, order references, invoice
fields. That is correct and deliberate. But **`dir="auto"` appears nowhere**, and
that is the one Matjar actually needs.

Store and product names in this marketplace are mixed script. The prior audit
names three real stores whose names are Latin — *Giggles Care*, *Let's meat*,
*Mehras Chtoura* (`19_REMAINING_ISSUES.md`) — sitting in an Arabic RTL document
alongside Arabic-named stores. A Latin string rendered inside an RTL paragraph
gets bidi-reordered whenever it ends with a number or neutral punctuation:
`Let's meat 2` renders as `2 Let's meat`, and `Mehras Chtoura - Zgharta` can flip
its segments.

`dir="auto"` tells the browser to take direction from the string's first strong
character, which is exactly the right rule for a user-supplied name.

**Fix:** `dir="auto"` on every element rendering a user-supplied name — store
name, product name, customer name, review author, address line. It is a
one-attribute change per site and it is the single highest-value RTL fix
available.

### `.text-money` exists and is used twice

`globals.css:305–310` defines the money treatment: `tabular-nums`,
`letter-spacing: 0`, `direction: ltr`, `unicode-bidi: isolate`. It is documented
as house standard in `audit/matjar-mobile-app-experience/05_MOBILE_DESIGN_SYSTEM.md`.

It is applied in exactly **two** places: `activity-list.tsx:137` and
`store-products.tsx:972`.

Being fair: the app does not therefore render money badly everywhere. `dir="ltr"`
is used 116 times and `tabular-nums` in 44 files, so the *effect* is achieved
manually in many places. But it is achieved inconsistently, and `unicode-bidi:
isolate` — the part that stops an adjacent Arabic word from reordering around the
number — is only present where `.text-money` is. The other 23 hand-rolled
`formatPrice` copies (`26_DESIGN_SYSTEM.md` §4) do not isolate.

**Fix:** apply `.text-money` wherever a currency amount renders, mechanically.

### The cover-position slider is a horizontal control for a vertical value in a bidirectional layout

`src/components/edit-store-form.tsx:211–221` — `<input type="range" min={0} max={100}>`
driving `objectPosition={50% ${coverPos}%}` (`:198`), i.e. the **vertical** crop
band of the store cover.

Two problems stacked:

1. A horizontal slider controls a vertical property. "Drag right" means "move the
   crop down". That is unintuitive in any direction.
2. Native `<input type="range">` reverses under `dir="rtl"` in every major
   browser. So an Arabic merchant drags left to increase, an English merchant
   drags right, and both are adjusting a vertical band. The value is not wrong —
   the mental model is.

**Fix:** replace with two or three named buttons (أعلى · وسط · أسفل / top ·
centre · bottom). Three states cover essentially every 16:9-into-3:1 crop, they
are keyboard-operable, they are direction-agnostic, and they are a larger touch
target than a slider thumb.

This is the only `type="range"` in the codebase, so the fix is contained.

---

## 8. The CSS `order` screen-reader tradeoff — recommendation

`19_REMAINING_ISSUES.md` documented this honestly and did not resolve it: the
mobile home page re-sequences sections with CSS `order`, so the DOM stays in
desktop order and a screen reader on a phone reads the old sequence. The
alternative — reorder the JSX and restore desktop with `lg:order-*` — moves the
same mismatch onto desktop, where keyboard navigation is more common.

Both stated options are bad. There is a third.

**Recommendation: agree one order, in the DOM, for both.**

The reason this was framed as unresolvable is the constraint "desktop must not
change". That constraint is worth relaxing here, because:

1. **Matjar is a mobile-first marketplace in a mobile-first market.** The mobile
   order was chosen deliberately in M-019 — categories, then discovery rails,
   then the merchant pitch last — because it is the sequence that serves a
   customer. There is no argument that the desktop sequence (hero, categories,
   store strips, merchant pitch) is *better* for anyone; it is just older.
2. **A visual reorder that a screen reader cannot see is a WCAG 1.3.2 failure**
   (meaningful sequence). CSS `order` is the canonical example in the spec's own
   guidance. This is not a nitpick — it is the one item in this document that is
   a straightforward conformance failure rather than a threshold miss.
3. **Two orders is also a maintenance cost.** Every future section has to be
   placed twice and reasoned about twice.

**Concrete proposal:** adopt the mobile sequence as the DOM sequence on both
breakpoints, and use `lg:` utilities only for *layout* (columns, spacing,
density) — never for order. If a specific desktop section genuinely needs to sit
higher, promote it in the DOM for both.

**If the product owner rejects that** — a legitimate call, since desktop is where
merchants sign up — then the fallback is to keep `order` but make the sequence
explicit to assistive tech is **not** possible: `aria-flowto` is not supported
and there is no ARIA property that reorders reading. So the honest fallback is to
accept the failure and record it, not to paper over it. Say so in the
accessibility statement rather than in a code comment.

---

## 9. Summary

| # | Finding | Severity | Fix size |
|---|---|---|---|
| 1 | `accent-soft` / `accent-foreground` = 1.21:1 in dark, in 5 components incl. the activity "needs you" badge | high | primitive + 5 lines |
| 2 | 64 orphaned `<label>` elements — unnamed controls | high | medium, TS-enforceable |
| 3 | No skip link; `<main>` has no id | high | 2 lines |
| 4 | `dir="auto"` used zero times on mixed-script names | high | mechanical |
| 5 | Form control borders at 1.19–1.42:1 (WCAG 1.4.11) | medium | one token |
| 6 | 4 chevrons point the wrong way in both directions | medium | 4 lines |
| 7 | `bg-emerald-600` + white = 3.77:1 on the primary contact CTA | medium | one variant |
| 8 | Home CSS `order` breaks meaningful sequence (WCAG 1.3.2) | medium | product decision |
| 9 | Bottom sheet: duplicate `aria-label` on backdrop and close | medium | 2 lines |
| 10 | RTL-reversing slider controlling a vertical value | medium | replace with 3 buttons |
| 11 | `.text-money` applied in 2 of ~25 money sites | medium | mechanical |
| 12 | `Field` required marker `aria-hidden`, no `aria-required` | low | 1 line |
| 13 | `text-accent` on `accent-soft` = 1.93:1 (light) | low | 1 line |

## 10. What could not be verified

- Every rendered contrast (tokens can be overridden inline).
- Every touch target's *effective* size — the prior audit already proved a grep
  produces false positives here.
- Whether the bottom sheet's focus trap works.
- Any screen-reader announcement, in either language.
- Keyboard traversal order on any page.
- Whether Arabic text actually clips, wraps or reorders at 320–430px.
- Zoom behaviour to 200%, and whether any fixed bar occludes content there.
