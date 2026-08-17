# 17 — Merchant Experience

Scope: the merchant dashboard home (`/[lang]/merchant/[storeId]`), the store
shell (sidebar + phone tab bar), and how sector-adaptive the navigation actually
is.

---

## 1. Verdict up front

**The merchant dashboard leads with what needs attention — for most sectors,
most of the time.** It is not a launcher of pretty tiles. The decorative
elements are real but small and mostly confined to the hero.

The problems are narrower than "it's decorative":

1. A **962-line page component** doing 20+ queries, which is a maintainability
   and latency problem rather than a design one.
2. **Sector adaptation collapses 17 sectors into 4 layouts**, and the widest
   bucket (`booking`, 11 sectors) is also the least well served.
3. The **hero occupies the entire first screen on a phone** before a single
   number appears.
4. **`items` is not derived from the sector** the way everything else is, so a
   hotel's dashboard offers "add a service" that leads to the wrong screen.

---

## 2. What the OS home actually shows, in order

`src/app/[lang]/(dashboard)/merchant/[storeId]/page.tsx`. Rendering order comes
from `WIDGET_ORDER` (lines 68-80):

```ts
const WIDGET_ORDER: Record<"commerce" | "food" | "booking" | "services", WidgetKey[]> = {
  commerce: ["kpis", "chart", "alerts", "today", "suggestions", "tasks", "activity"],
  food:     ["today", "kpis", "chart", "alerts", "suggestions", "tasks", "activity"],
  booking:  ["today", "kpis", "alerts", "suggestions", "activity", "tasks", "chart"],
  services: ["today", "kpis", "alerts", "suggestions", "activity", "tasks", "chart"],
};
```

Above that grid, unconditionally:

| # | element | lines | decoration or work? |
|---|---|---|---|
| 1 | "Back to stores" link | 840-846 | navigation |
| 2 | Sector-tinted hero: logo, name, type chip, tagline, item count, "View public page" | 849-909 | **mostly decoration**; the pending-state chip (895-899) is real information |
| 3 | Quick actions row (2-3 sector-specific buttons) | 911-915 | **work** |
| 4 | Onboarding checklist / share card | 918-931 | **work** |
| 5 | The widget grid, sector-ordered | 933-940 | **work** |
| 6 | QR + short-link share card, or the pending explainer | 942-957 | mixed |

So of six blocks, one is decoration and one is half. That is a defensible ratio,
and the ordering logic inside the grid is genuinely thoughtful — a restaurant
opens on the pass, a clinic on today's appointments, a shop on money. The
comments at lines 55-58 and 73-79 state the reasoning and the code matches it.

### The honesty of the alerts

`AlertsCard` is the strongest part of this screen. It shows only three things,
all real (lines 503-543):

- trial ending within 3 days
- pending orders, with a live count
- low stock, per product, with the actual number

There are no vanity alerts, no "you have 0 new messages". The `showAlerts` flag
even lets the empty state render for owners, so the absence of alerts is itself
information. This is the right instinct and should be the model for everything
else on the page.

### The suggestions engine

Five rules (lines 612-650): add an item, finish the checklist, restock, run a
campaign, set up an automation. Three of the five point at Pro/Business modules
(`campaigns` requires `minPlan: "business"`, `automations` likewise). For a
free-plan store, two of at most three suggestions are upsells to a locked
screen. `hasAudience` gates the campaign suggestion behind having followers or
orders, which is good discipline; the automation rule has no such gate and fires
for every store on day one.

---

## 3. Where decoration wins

### 3.1 The hero is a full phone screen

`p-6 sm:p-8`, a 64px logo, an `h1` at `text-2xl sm:text-3xl`, a tagline line, a
type chip, a public-page button, then a quick-actions row — inside a
`rounded-3xl` gradient card. On a 375×812 viewport that is essentially
everything above the fold. A merchant checking "any new orders?" between
customers sees their own shop name and a gradient first.

The phone tab bar (§5) rescues this — one tap goes straight to orders. But the
*home* screen still opens on identity rather than state. On mobile the hero
should compress: logo + name in one 44px row, the type chip and tagline dropped
(the merchant knows what their own shop is), quick actions kept.

### 3.2 The revenue chart outranks the alerts for commerce sectors

`commerce: ["kpis", "chart", "alerts", ...]` — and both `kpis` and `chart` take
`lg:col-span-2` (line 829-832), so on desktop they are full-width. A shop with
4 pending orders sees a 14-day bar chart before it sees the pending orders. The
KPI row already carries `pendingRevenue` with `highlight: pendingRevenue > 0`
(line 398), so the number is *represented* — but a highlighted stat is not the
same as "4 orders are waiting for you".

Swap to `["kpis", "alerts", "chart", ...]`. The chart is a review artefact; the
alerts are today's work.

### 3.3 The checklist can nag alongside a suggestion that says the same thing

Line 621: if `!checklistDone`, push a `checklist` suggestion. The checklist card
itself is already rendered directly above at line 921. The same ask appears
twice on one screen. Drop the suggestion rule.

### 3.4 The share card is decoration for a store with no audience

Lines 946-957 render a QR code and short link for every active store. For a shop
with 0 followers and 0 orders this is aspirational furniture at the bottom of
the page. It is genuinely valuable at the *moment* the store is approved — which
is exactly what `StoreChecklist`'s completion state already does (lines 83-112
of `store-checklist.tsx`). Keeping both means the celebration is diluted.

---

## 4. Sector adaptation: 17 sectors, 4 layouts

`layoutKind` (lines 747-754):

```ts
category === "food"                ? "food"
: sector.flow.kind === "commerce"  ? "commerce"
: category === "services"          ? "services"
: "booking"
```

| bucket | sectors |
|---|---|
| `food` | food |
| `commerce` | retail, automotive, pharmacy, farm |
| `services` | services |
| `booking` | healthcare, realEstate, beauty, fitness, sportsCourts, education, events, hospitality, petCare, professional, contractors |

**11 of 17 sectors share one layout**, and `booking` and `services` have
*identical* orderings anyway — so it is really 3 layouts.

That would be fine if the bucket were coherent. It is not. Inside `booking`:

- **`realEstate`** has `daily: ["leads", "bookings", "items", "tasks"]` and
  `customersNoun: "leads"`. Its day is a lead inbox. The `today` panel it leads
  with only ever shows bookings and requests (lines 469-500) — `leads` is not
  among the counters. **A real-estate agent's dashboard leads with an empty
  panel.**
- **`hospitality`** has `daily: ["stays", "units", ...]` — no `bookings`, no
  `orders`. `hasOrders` and `hasBookings` are both false, so `showToday` is
  false and `stats` is empty unless `canRevenue && report` (it can be). The hero
  and the checklist carry the screen. `sectorPrimarySetup()` at least gives it
  the right checklist step.
- **`events`** has `daily: ["tickets", "items", "tasks"]` — same shape, same
  empty `today` panel.
- **`sportsCourts`** has `bookings` + `resources`, so `today` works.
- **`contractors`** has `requests` + `portfolio`, so `today` works via the
  requests counter.

So `hospitality`, `events` and `realEstate` — three sectors — lead their
dashboard with a widget that structurally cannot have content for them. The fix
is to widen the `counters` construction (lines 469-490) to include `leads`,
`stays` and `tickets`, exactly as the phone tab bar already does at
`layout.tsx:195-202`. **The layout file solved this problem; the page file did
not.**

### 4.1 `quickDefs` is 86 lines of hand-written per-sector config

Lines 653-741 hard-code 2-3 quick actions for each of the 17 sectors. That is
the only place in the merchant experience that does *not* derive from
`sectors.ts`, and it has drifted:

- `hospitality` gets `{ key: "addItem", label: t.quickAddService, path: "items" }`
  — but a hotel's core entity is `accommodation_units`, and
  `sectorPrimarySetup("hospitality")` already knows that. The quick action sends
  the merchant to the wrong screen.
- `events` gets the same wrong `items` link when it should be `tickets`.
- `fitness` and `education` get "add a service" when their setup entities are
  `store_membership_plans` / `store_courses`.
- `sportsCourts` gets "add a service" when it needs `resources`.

Five of 17 sectors have a quick action pointing at a screen that is not where
their work is. The whole table should be derived from
`sector.modules.daily[0..2]` filtered by `canSee`, with
`sectorPrimarySetup()` overriding the "add" action — the same three inputs the
phone tab bar already uses.

### 4.2 What *is* well adapted

Credit where due:

- `WIDGET_ORDER` ordering per bucket, with stated reasoning.
- `customersNoun` — a clinic's dashboard says "patients", an agency's says
  "leads" (`layout.tsx:129`).
- `itemsKey` — the catalog is called "menu" / "products" / "services" /
  "listings" per sector (`layout.tsx:127`).
- Module visibility per sector *and* per staff permission *and* per plan
  (`layout.tsx:104-109`, `toItem`'s `locked`).
- `heroTint` / `iconTint` per sector — decoration, but cheap and consistent.

---

## 5. The mobile merchant shell

`src/components/merchant-sidebar.tsx` + `src/components/merchant-tab-bar.tsx`.

### What it does

- **Desktop:** sticky 240px rail, `sticky top-16 h-[calc(100dvh-4rem)]`, grouped
  nav (`daily` / `people` / `money` / `store`) with pinned items — subscription,
  settings, edit — below a divider. Active-row matching is longest-prefix
  (`merchant-sidebar.tsx:141-151`), so an order detail page keeps "Orders" lit.
- **Phone:** a 48px top bar (menu, store name, view-public) **plus** a fixed
  56px bottom tab bar, with the drawer demoted to overflow behind "More".
- The tab bar is **derived from the sector**, not hardcoded
  (`layout.tsx:186-256`):

```ts
const opsKey     = firstVisible(["orders","bookings","stays","tickets","requests","leads"]);
const catalogKey = firstVisible(["items","units","resources","classes","courses"]);
const reportKey  = firstVisible(["reports","accounting"]);
```

`firstVisible` intersects the sector's own module list with `canSee`, so a staff
member never sees a tab they cannot open, and a restaurant's second tab is
Orders while a clinic's is Appointments — from configuration, not a switch
statement. The comment at `layout.tsx:191-194` explains that `stays` and
`tickets` are in the list *because* a per-sector resolution check caught that
hotels and event organisers otherwise had no operations tab at all. That is the
right way to build this, and it is the model §4.1 should copy.

- The ops tab carries a badge, and **only** from a real count of pending orders
  (`layout.tsx:215-223`), with the comment "A number they cannot clear would be
  worse than none." Correct.
- The content area gets `pb-[calc(3.5rem+env(safe-area-inset-bottom))]`
  (`layout.tsx:272`) so the last row is never trapped under the bar.
- Drawer hygiene is careful: Escape closes, focus moves to the close button,
  body scroll locks, `overflow-hidden` on the wrapper stops the off-canvas panel
  adding horizontal scroll, `motion-reduce:transition-none` on both the scrim
  and the panel, and route changes close it during render rather than in an
  effect (`merchant-sidebar.tsx:128-135`) so the drawer never paints over the
  new route for a frame.

### Problems

**5.1 Two bars plus a header cost 128px of a phone screen.** The dashboard
header is `h-16`, the mobile top bar `h-12` sticky beneath it, the tab bar `h-14`
fixed at the bottom. On a 812px-tall viewport that is ~16 % of the screen before
content. The top bar carries the menu button, the store name, and a
view-public link — the store name is already the first thing in the hero below
it, and "More" in the tab bar already opens the same drawer. The top bar is
close to redundant on any screen that has the tab bar.

**5.2 The badge only ever counts orders.** `opsBadge` is populated only when
`opsKey === "orders"` (`layout.tsx:216`). A clinic with 6 pending appointments,
a contractor with 4 open requests, an agency with 3 unread leads all get a bare
icon. The counts already exist — the page computes `pendingBookings`,
`pendingRequests` a few hundred lines later. Extending the badge to the other
`opsKey` values is a small query each and is the highest-value mobile change
available.

**5.3 The 4th tab is Reports, which is Pro-locked for free stores.**
`reportKey = firstVisible(["reports","accounting"])`, and both carry
`minPlan: "pro"` / `"business"` (`sectors.ts:144-145`). `firstVisible` filters
by `canSee`, which checks ownership and staff permission — **not plan**. So a
free-plan owner gets a permanent bottom-bar tab that opens a paywall. One of
four primary phone destinations is an upsell.

**5.4 `stays` and `tickets` do not appear in the tab bar's operations list for
`realEstate`.** `leads` is last in the `opsKey` candidate list, after `requests`,
which is correct for realEstate (it has no requests module) — this one is fine.
Noted only because §4 flags the same gap on the page side, where it is not fine.

---

## 6. Performance, because it is a merchant-experience issue

The OS home issues, on every load:

- 16 queries in one `Promise.all` (lines 174-308) — good.
- **Plus** `can_manage_store` RPC (line 102), the store row (107), a staff-perms
  lookup for non-owners (145), `store_visits_summary` RPC (line 376) **outside**
  the `Promise.all`, and a `sectorPrimarySetup` count (595) also outside it.

Two sequential round-trips hang off the end of the parallel batch for no reason
— both depend only on values known before it starts. Folding `store_visits_summary`
and the primary-setup count into the same `Promise.all` removes two serialised
network hops from the screen a merchant opens most often, on connections that in
Lebanon are frequently mobile.

---

## 7. Recommendations, ordered by value per unit of work

1. **Add `leads`, `stays` and `tickets` to the `today` panel counters**
   (page.tsx:469-490), copying the candidate list the layout already uses.
   Fixes an empty lead widget for `realEstate`, `hospitality`, `events`.
2. **Badge the ops tab for bookings, requests and leads**, not only orders
   (`layout.tsx:215-223`).
3. **Derive `quickDefs` from `sector.modules.daily` + `sectorPrimarySetup()`**
   instead of the 86-line hand-written table. Fixes 5 sectors pointing at the
   wrong screen and deletes the last un-derived piece of sector config in the
   merchant UI.
4. **Reorder `commerce` to `["kpis", "alerts", "chart", …]`.** One line.
5. **Drop the `checklist` suggestion rule** — it duplicates the card above it.
6. **Compress the hero on phones** to a single 44px identity row plus quick
   actions.
7. **Don't put a Pro-locked module in the 4th phone tab.** Either make
   `firstVisible` plan-aware, or fall back to `tasks` (free, and always present
   in every sector's `daily` group) for free stores.
8. **Fold the two straggler queries into the existing `Promise.all`.**
9. **Consider removing the mobile top bar** where the tab bar is present.
10. **Split `page.tsx`.** 962 lines with data-fetching, 17-sector config tables
    and JSX in one file. The widget components are already extracted; the
    per-sector tables (`WIDGET_ORDER`, `quickDefs`) belong in `sectors.ts` next
    to the config they mirror, and the query batch belongs in
    `src/lib/data/`, where `store-view.ts` and `product-reviews.ts` already live.

---

## Could not verify

- No real-device testing was done. Every mobile claim here is read from the
  markup and the Tailwind classes (`h-16` + `h-12` + `h-14`, the safe-area
  padding, the `overflow-hidden` clip) — not from a phone.
- No load timings. §6 identifies two serialised round-trips structurally; how
  much wall-clock time they cost was not measured.
- No merchant feedback of any kind informs this document. Which widget merchants
  actually look at first is unknown; `hub_tool_events` and `store_visits` exist
  but nothing instruments the dashboard's own widgets, so the ordering
  recommendations in §7 are reasoned from what the data says is urgent, not from
  observed behaviour.
