# 16 — Customer experience

**Method and its limits.** Everything below is read from source, tokens, the
dictionary files and the prior audit. **No page was opened in a browser.** The
in-app browser pane cannot composite this application — the root cause was
pinned down in the previous audit (`audit/matjar-mobile-app-experience/18_BEFORE_AFTER.md`:
page content stays inside the React streaming boundary `S:1`, never revealed,
never hydrated), and no session exists to reach an authenticated route. So there
are **no screenshots at eight viewport sizes, no visual findings, no timing
numbers** in this document. Where a finding needs an eye on a real phone it says
so instead of pretending otherwise.

The prior audit fixed the structural problems: five tabs, an activity centre, a
search screen, a filter sheet, a cart sheet, a confirmation screen. This document
does not re-litigate those. It looks at what the journey does *after* those
fixes landed.

---

## 1. The shape of the surface

65 customer `page.tsx` files under `src/app/[lang]/(site)/`. Eleven active
stores, 65 products, 7 orders, 22 bookings.

That ratio is the single most important fact about this customer experience.
Matjar has roughly one customer-facing route per active store, and roughly one
route per six products. The routes are not badly built — they are simply more
numerous than there is content to fill them.

Whole top-level sections exist with their own navigation, their own empty
states and their own vocabulary:

| Section | Routes | What the prior audit found about its content |
|---|---|---|
| `/crafts/*` | 7 | "0 live craft providers" (`19_REMAINING_ISSUES.md`, data prerequisites) |
| `/freelance/*` | 4 | not measured |
| `/jobs/*` | 4 | not measured |
| `/wholesale/*` | 4 | not measured |
| `/market/*` | 4 | classifieds; the tab it used to own was reassigned to `/activity` |
| `/hub/*` | 5 | merchant-facing content living in the customer group |

Plus single-purpose discovery routes: `/best-sellers`, `/clearance`, `/flash`,
`/offers`, `/deal`-backed surfaces, `/map`, `/categories`, `/merchants`,
`/delivery`, `/following` (now a redirect), `/trust`, `/about`, `/help`,
`/contact`, `/pricing`, `/privacy`.

**Why this matters more than any individual screen.** A customer's confidence in
a marketplace comes from finding the same thing in the same place twice. With 65
routes and 65 products, most paths a customer explores end in an empty state.
An empty state is honest, but a customer who hits three of them stops exploring.
The prior audit already applied the right instinct in one place — `src/lib/rail.ts`
hides a home rail with fewer than three real items — and that instinct is not
applied at route level.

**Recommendation.** Not "delete features". Gate them the way rails are gated:
a section that cannot show three real items should not be linked from primary
navigation, the footer, or the home page. It can stay reachable by URL and by
search. This costs nothing and removes the majority of the dead ends.

---

## 2. Where decisions are unnecessary

### 2.1 Two saved-things surfaces, one tab

- `/favorites` reads `follows` — **saved stores** (`favorites/page.tsx:39`)
- `/wishlist` reads `wishlist` — **saved products** (`wishlist/page.tsx:46`)
- `/following` already redirects to `/favorites` (`following/page.tsx:15`) — that
  consolidation was done, and done well.

The bottom tab المفضلة points at `/favorites` only (`src/components/bottom-nav.tsx:57`).
A customer who tapped the heart on a **product** has no tab that reaches it. The
dictionary confirms these read as two different promises to the user:
`favorites.title` = "المفضّلة", `wishlist.title` = "قائمة الأمنيات"
(`src/i18n/dictionaries/ar.json`).

The customer is being asked to remember which of two words they used when they
saved something. That is an unnecessary decision.

**Fix:** one saved screen with two segments (متاجر · منتجات), exactly the
pattern `/activity` already uses for its four transaction kinds. `/wishlist`
becomes a redirect, the way `/following` already is.

### 2.2 `/explore` vs `/search` vs `/categories` vs `/map` vs `/merchants`

Five entrances to "find a business". They are all defensible individually;
together they ask the customer to pick a browsing *mode* before they have told
the system what they want. The tab bar offers استكشف (`/explore`); the header
offers search; the home page offers category tiles; `/map` and `/merchants` are
reachable from the footer.

**Fix:** `/explore` is the one that should absorb the others as view modes
(list / map) and as filter entry points. `/categories` and `/merchants` become
routes that deep-link *into* explore with a filter pre-applied rather than
separate destinations with their own layouts.

---

## 3. Where CTAs are unpredictable

### 3.1 The order confirmation is right; the follow-through is not

The confirmation screen (`src/components/store-products.tsx:945–1012`) is
genuinely good and should be the house standard: it states the reference
(`:954`), the amount actually committed (`:972`), and what the shop does next
(`dict.orders.nextPending`, `:977`). That answers the two questions a customer
has at that exact moment.

But the primary follow-through action inverts:

| Customer | Where the button goes | File:line |
|---|---|---|
| **Guest** | `/{lang}/track/{orderId}` — the specific order | `store-products.tsx:1002` |
| **Signed in** | `/{lang}/orders` — the *list* | `store-products.tsx:994` |

The signed-in customer, who gave the platform more, gets the worse link. They
land on a list and must find the order they placed four seconds ago.

**Fix:** both go to the order. `/{lang}/orders/{placedOrderId}` exists
(`src/app/[lang]/(site)/orders/[id]/page.tsx`).

### 3.2 The activity centre links to lists, not to things

`/activity` is the right idea and the right build. But three of its four card
types do not deep-link:

| Kind | `href` | File:line |
|---|---|---|
| order | `/{lang}/orders/{id}` — correct | `src/lib/data/activity.ts:86` |
| booking | `/{lang}/bookings` — **the list** | `src/lib/data/activity.ts:108` |
| craft request | `/{lang}/crafts/requests` — **the list** | `src/lib/data/activity.ts:129` |
| lead | `/{lang}/messages` — **the list** | `src/lib/data/activity.ts:152` |

The whole argument for the activity centre was "a customer who cannot answer
*where is my thing* in one tap has a catalogue, not a marketplace"
(`src/lib/data/activity.ts:6–8`). Three of four kinds still cost a second hunt.

This is not a design bug — it is a missing route. There is no
`/bookings/[id]`, no `/crafts/requests/[id]`. The card is doing the best it can.

**Fix:** add the two detail routes, then point the cards at them. Until they
exist, the card should at least carry the identifying detail (date/time for a
booking, trade for a craft request) so the list it lands on can be scanned.

### 3.3 One primary action, five visual treatments

`src/components/ui/button.tsx` defines five variants and is the stated single
source. It is not the only source. Green WhatsApp CTAs are hand-rolled with raw
palette classes in at least eight places — `store-products.tsx:986`,
`crafts/p/[id]/page.tsx:266`, `delivery/page.tsx:88`, `market/[id]/page.tsx:186`,
`booking-panel.tsx:608`, `join-action.tsx:84`, `crm-manager.tsx:308` and `:408`.
Each is `bg-emerald-600 … text-white` with its own height and padding.

So "contact the merchant" — the most important non-transactional action in a
marketplace where there is no payment rail — looks slightly different on every
screen it appears on, and its height varies (`py-2`, `py-2.5`, `py-3`, `h-11`).

**Fix:** a `whatsapp` variant on `Button`/`ButtonLink`. See `26_DESIGN_SYSTEM.md`
— the colour also fails contrast at 3.77:1 for white text.

---

## 4. Where a success state fails to say what happens next

| Flow | Does the success state say what happens next? | Evidence |
|---|---|---|
| Place order | **Yes** — reference, total, `dict.orders.nextPending`, three actions | `store-products.tsx:945–1012` |
| Book appointment | **Yes** — the prior audit shipped the request-vs-confirmation statement and the cancellation window before the button (M-014, fixed) | `19_REMAINING_ISSUES.md` |
| Save a product to wishlist | **No** — the customer is not told where it went, and the tab bar has no route to it | §2.1 |
| Send a lead / inquiry | **Unclear** — the lead lands in `/messages`, and its status has no Arabic wording at all (§5.1) |
| Follow a store | **No** — nothing states what following does. `favorites.title` says "المفضّلة"; the button on the store says follow. Two words, one relationship |
| Enter a phone at checkout | **Nothing is shown, and something happens** — see §6 |

---

## 5. The unified activity centre — a close read

`/activity` (`src/app/[lang]/(site)/activity/page.tsx`) with
`getCustomerActivity` (`src/lib/data/activity.ts`) and `ActivityList`
(`src/components/activity-list.tsx`).

**What is right, and should not be touched:**

- Four independent reads, each scoped by `customer_id`, each `.limit(50)`
  (`activity.ts:44–71`). No union view, no `SECURITY DEFINER` wrapper invented
  for a table of this size. Correct call.
- Every card states its own **type** (`activity-list.tsx:109`). The reasoning is
  written into the file (`activity.ts:10–13`) and it is the right reasoning.
- Filter chips with zero behind them are not rendered at all
  (`activity-list.tsx:56`). A filter that leads to an empty screen is a dead end;
  this avoids it.
- The badge counts only what the **customer** must act on
  (`activity.ts:163–169`), not everything open. A badge the user cannot clear is
  a badge they learn to ignore.

**Four real defects:**

### 5.1 Lead statuses render as raw English database values

`activity/page.tsx:41` passes `lead: {}` as the status-label map. `activity-list.tsx:94`
falls back to `it.status` when the map has no entry. `dict.activity` contains no
status block for leads (verified against `src/i18n/dictionaries/ar.json`).

So in an Arabic RTL interface, an inquiry card shows a pill reading `new`,
`contacted` or `closed`. **Severity: high** — it is the only place in the
customer app that leaks a database enum to a customer, and it does it on the
screen the new tab bar points at.

### 5.2 Dates are always Arabic, even in English

`activity-list.tsx:111` — `new Date(it.createdAt).toLocaleDateString("ar", …)`.
The locale is hardcoded. An English-locale customer sees Arabic month names on
every activity card, on a page where every other string is correctly translated.

### 5.3 Every status looks the same

`activity-list.tsx:133` — every status pill is `bg-surface-muted`, regardless of
what the status means. A cancelled booking, a completed order and an order out
for delivery are visually identical. The design system already carries the
semantic pairs (`--success-soft`, `--danger-soft`, `--warning-soft`, all
AA-verified — see `26_DESIGN_SYSTEM.md`) and `ui/badge.tsx` already maps them to
variants. The activity card does not use it.

This matters more here than on `/orders`, because `/activity` is the one screen
mixing four vocabularies. Colour is what lets a customer scan a mixed list.

### 5.4 The "needs you" pill is invisible in dark mode

`activity-list.tsx:117` — `bg-accent-soft … text-accent-foreground`. In the dark
token set, `--accent-foreground: #0b1220` on `--accent-soft: #2b2410` measures
**1.21:1** (computed from the token hex values in `src/app/globals.css:190–191`).
Near-black text on dark brown. The one marker telling the customer which of their
transactions needs them disappears on a dark phone.

Same pair, same problem, in four other components — see `25_ACCESSIBILITY_RTL.md`.

### 5.5 Scale note

Four `.limit(50)` reads and no pagination. At 7 orders and 22 bookings this is
correct and cheap. It becomes a silent truncation the first time a customer
passes 50 of any one kind. Not urgent; worth a comment in the file so the next
reader knows it was a decision.

---

## 6. The checkout intent capture — a customer-experience problem before it is a privacy one

`src/components/store-products.tsx:1405–1411` fires
`captureCheckoutIntent(...)` on the **blur** of the phone field. That calls
`record_checkout_intent` (`supabase/migrations/0120_abandoned_cart.sql:65`) with
the phone, the name and the full cart, as soon as four characters have been
typed — before the customer has agreed to anything.

From the customer's side: they typed a number into a shop's checkout, changed
their mind, closed the tab. Thirty minutes later that shop is notified, with a
one-tap wa.me link to their number
(`0120_abandoned_cart.sql:1–7`, `:145–175`).

The engineering is careful — fail-safe, never touches the order path, deduped
per intent. The **experience** is that the phone field is a submit button the
customer did not know they pressed. Nothing on the screen says so, and the
privacy page says the opposite (`privacy/page.tsx:36`: "we collect only the
information needed to run the service: your account, orders, and bookings").

**Fix, cheapest version:** move the capture to the moment the customer takes a
deliberate step forward (opening the review step, or a first submit that fails
validation), and put one line under the phone field saying the shop may follow
up. Full treatment in `23_SECURITY_PRIVACY.md`.

---

## 7. Route-by-route notes

### `/` — home
Re-sequenced for phones via CSS `order` (M-019, fixed). Known screen-reader
tradeoff carried forward — see `25_ACCESSIBILITY_RTL.md` §7 for a recommendation
rather than a restatement. "الأقرب إليك" remains unbuildable: 8 of 11 active
stores have no coordinates (M-020, still open — content, not code).

### `/explore`
Chip rail + filter sheet shipped (M-004). The filter set is still one set for
all sectors; the prior audit's own §07 says a restaurant must never be filtered
by "عدد الغرف". Sector-conditional filters are the remaining work and belong
with the vertical-search document, not here.

### `/search`
Full-screen search with recents shipped (M-005), reusing `search_products_fuzzy`
and `normalize_search`. Not verifiable here beyond structure.

### `/store/[id]`
The store page reads its whole product catalogue with **no limit**
(`src/lib/data/store-view.ts:120–128`) and its variants with **no limit**
(`store-view.ts:165–171`). At 65 products platform-wide this is free; the cap
consequences are in `24_PERFORMANCE.md`. Storefront themes (`[data-sf]`,
`globals.css:413–529`) give merchants five looks — a genuine differentiator, and
the only place in the app where a merchant's identity survives the marketplace's.

### `/product/[id]`
Sticky mobile buy bar shipped. Variant selection above ~6 options should move
into the bottom sheet primitive that now exists — the prior audit named this and
it is still open.

### `/activity`
Section 5.

### `/orders`, `/orders/[id]`
Detail route exists and is the only transaction kind that has one. `/orders`
uses a chevron that points the wrong way in both directions
(`orders/page.tsx:100` — see `25_ACCESSIBILITY_RTL.md` §4).

### `/bookings`
List only. No `/bookings/[id]`. This is what forces `activity.ts:108` to link to
a list.

### `/account`
Not opened. Structurally it remains the parent of the surfaces the tab bar does
not reach (`/wishlist`, `/messages`, `/crafts/requests`, addresses, settings).

---

## 8. Ranked summary

| # | Finding | Severity |
|---|---|---|
| 1 | Lead status renders as raw English enum on `/activity` | high |
| 2 | "Needs you" marker invisible in dark mode | high |
| 3 | Phone captured and shared with the merchant on blur, contradicting the privacy page | high |
| 4 | Booking / craft / lead cards link to lists because detail routes do not exist | medium |
| 5 | Saved products unreachable from the tab bar | medium |
| 6 | Signed-in customer gets a worse post-order link than a guest | medium |
| 7 | Activity statuses all rendered in one neutral colour | medium |
| 8 | Dates hardcoded to Arabic locale | medium |
| 9 | 65 routes against 65 products; most exploration ends in an empty state | medium |
| 10 | WhatsApp CTA hand-rolled eight ways | low |

## 9. What could not be verified

- Anything visual: spacing, alignment, overflow, animation, colour in situ.
- Whether the bottom sheet actually opens, traps focus and restores it.
- Whether the search screen's debounce and empty states behave.
- Any authenticated screen (`/activity`, `/orders`, `/account`) at all — no
  session is available.
- Real emptiness of `/jobs`, `/freelance`, `/wholesale`, `/market`. The craft
  provider count (0) comes from the prior audit, not from a query run here.
