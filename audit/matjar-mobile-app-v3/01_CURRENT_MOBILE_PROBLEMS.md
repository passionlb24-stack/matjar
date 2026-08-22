# What the mobile experience actually is today

Measured on a production build at **390 × 844**, Arabic (`dir="rtl"`), before any
change in this sprint. Everything below is a number read off the rendered page,
not an impression of the code.

Recording it first because half of what a brief like this assumes usually turns
out to be already done, and the other half is worse than described. Both were
true here.

---

## Already right — do not "fix" these

**Bottom navigation exists and is already the right five.** الرئيسية · تصفّح ·
طلباتي · المفضلة · حسابي. Five destinations, icon + label, stable across
sectors, no cart or per-sector tab. This is what §6 asks for; it is already
shipped.

**No horizontal overflow.** `scrollWidth - clientWidth = 0` on Home. There is a
committed e2e test asserting this at 375px, so it is guarded rather than lucky.

**Touch targets pass.** All 10 interactive elements in the header and bottom nav
clear 44 × 44 *once the `::before` hit area is measured*. The menu button's own
box is 36 × 36, which looks like a defect and is not — this repo grows hit areas
with a transparent `before:absolute before:-inset-*` pseudo-element. Measuring
`getBoundingClientRect().height` alone reports a false positive here, and has
done so four times in this project's history.

**The desktop header is already mostly suppressed.** The markup carries 15
controls; **10 are correctly hidden at 390px.** §8's list of things that must not
appear together — سوق الأحد, عروض, مركز الأعمال, للتجّار, language toggle,
dark-mode toggle — are all already `hidden lg:*`. The brief's diagnosis of the
mobile header is largely stale.

---

## Genuinely wrong

### 1. The first screen sells the platform instead of serving the customer

| element | top | height |
|---|---|---|
| header | 0 | 120 |
| **hero section** | 120 | **293** |
| **`<h1>` "كل متجر ومطعم وخدمة في لبنان بمكان واحد"** | 160 | **104** |
| "تصفّح حسب التصنيف" heading | 445 | 64 |

A customer who opens the app spends the first **445 px** — more than half of an
844 px screen — on a corporate headline before reaching a single thing they can
tap toward what they came for. §9 asks for location, search, categories and
nothing else in the first viewport.

### 2. A merchant call-to-action sits in the customer header

Of the six controls visible at 390px, one is **`افتح متجرك` (97 × 36)** — open
your own store. That is a recruitment pitch occupying scarce header width on the
screen where somebody is trying to buy something. §8 says secondary controls
belong in Account.

### 3. There is no location control at all

§9 and §10 both put location first, and the platform has the data — every store
carries an `area`, and 7 of 15 carry coordinates. Nothing on Home reflects where
the customer is.

### 4. Home is 4.4 screens tall

`scrollHeight = 3687 px` against an 844 px viewport. §51.5 asks for "much
shorter and calmer". The tail is a "كمان على متجر" block at 1599 px and an
unheaded block at 1851 px, below two card rails.

### 5. Search has no dedicated mobile screen

`/ar/search` renders a results page with one section and an `<h1>` reading
"نتائج البحث عن …". Tapping the header field goes straight to results. §11 asks
for a full-screen search *experience* — recent searches, category shortcuts,
suggestions, grouped results — which does not exist as a screen today.

### 6. `/ar/explore` has zero `<section>` elements

The main discovery route is a flat list. §13 asks category and discovery screens
to behave like discovery pages rather than sitemaps.

---

## The one that is already good, and should be the model

`/ar/store/<id>` for the clinic renders **five identified sections** —
`sec-healthcareInfo`, `sec-doctors`, `sec-hours`, `sec-catalog`, `sec-reviews` —
in a sector-aware order, with four sticky elements. §17–19 describe a business
profile as a "mini app" with sticky sector tabs; the sectioning and the
sector-aware ordering are already here. What is missing is the mobile
*presentation* of it, not the information architecture.

---

## What this means for the plan

Phase 1 is smaller than the brief assumes: the shell largely exists. The real
work is Home's first viewport, a dedicated search screen, discovery on
`/explore`, and mobile presentation of the profile and transaction screens.

Anything below that already passes — bottom nav, touch targets, overflow — gets
a regression check, not a rewrite.
