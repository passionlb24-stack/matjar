# 29 — QA plan

## 0. The rule this document follows

**A flow is not marked passable because the code for it exists.** Three levels
are used, and the difference between them is evidence, not optimism:

| Mark | Means |
|---|---|
| **Supported** | UI, server primitive and data model all exist and are wired end to end, and the path is exercised somewhere today |
| **Partially supported** | The path exists but has a named gap — a missing guard, a missing detail route, a client-side-only rule, or no live data to run it against |
| **Not supported** | The path cannot be completed, or there is no data of that kind on the platform |

**No flow below is marked as tested.** Nothing was executed. There is no browser
session, no authenticated session, no device, and the production database could
not be queried from this session (the auto-mode classifier blocked read access).
So sector coverage is inferred from **code and schema**, not from live rows.

That is a real limitation and it is the reason §3 exists as a plan rather than a
report.

---

## 1. What the existing test suite covers

`vitest.config.ts`:

```
environment: "node"
include: ["src/**/*.test.ts"]
```

**19 files, 178 tests.** Every one is a pure-function unit test in `src/lib/`.

| Tests | File | Domain |
|---|---|---|
| 25 | `product-import.test.ts` | spreadsheet import parsing |
| 22 | `freelancer-trust.test.ts` | trust scoring |
| 18 | `order-math.test.ts` | **order totals, coupon, loyalty, fees** |
| 16 | `attendance.test.ts` | clock-in/out state machine |
| 11 | `store-experience.test.ts` | sector → surface resolution |
| 10 | `booking-slots.test.ts` | slot generation |
| 10 | `admin-search.test.ts` | admin search parsing |
| 9 | `search-state.test.ts` | search URL state |
| 8 each | `barcode`, `phone` | |
| 7 | `currency.test.ts` | |
| 6 each | `hub-calc`, `note-hint` | |
| 5 each | `attributes`, `whatsapp` | |
| 4 | `jsonld.test.ts` | |
| 3 each | `geo`, `site` | |
| 2 | `i18n/no-duplicate-keys.test.ts` | dictionary integrity |

### What this suite is good at

The three highest-value files are `order-math`, `attendance` and
`booking-slots` — the pure logic behind money, hours and availability. Testing
those as pure functions was the right call: they are where an error is silent and
expensive, and they are the parts that can be tested without a database. 178
fast tests that run in CI on every change is a real safety net and it is more
than most projects this size have.

### What it does not cover — and this is the whole gap

| Not covered | Consequence |
|---|---|
| **Any component.** No jsdom, no happy-dom, no Testing Library. | The bottom sheet's focus trap, the tab bar's active state, the activity filter, the cart sheet — none has ever been asserted, and the prior audit could not run them in a browser either. `ui/bottom-sheet.tsx` has therefore **never executed**. |
| **Any route.** No integration tests. | 65 customer routes and 72 dashboard routes with zero coverage. |
| **Any query.** `src/lib/data/**` (15 files, ~2,015 lines) has zero tests. | The unbounded queries in `24_PERFORMANCE.md` §4 would not fail a test if they truncated. |
| **Any RLS policy.** `supabase/tests/` contains one file, `checkout_pricing.test.sql`. | 399 `create policy` statements, one SQL test. Every finding in `23_SECURITY_PRIVACY.md` §3 is the kind a policy test would have caught. |
| **Any end-to-end flow.** No Playwright, no Cypress, no config for either. | Nobody has ever asserted that an order can be placed. |
| **Accessibility.** No axe, no jest-axe. | The 64 orphaned labels and the 1.21:1 badge in `25_ACCESSIBILITY_RTL.md` are both machine-detectable and neither was detected. |
| **Visual regression.** None. | The storefront themes (`globals.css:413–529`) can regress silently in five ways at once. |

**Priority order for closing this**, chosen by what fails most expensively:

1. **RLS policy tests in `supabase/tests/`.** One file exists; the pattern is
   established. Each test is `begin; set local role authenticated; set local
   request.jwt.claims …; select …; rollback;`. This is the cheapest coverage
   available and it guards the things in `23_SECURITY_PRIVACY.md` §3.3 that leak
   salaries to a cashier.
2. **A `.limit()` assertion test over `src/lib/data/**`.** A static test that
   fails when a `.select()` on a growth table has neither `.limit()` nor
   `.range()`. Twenty lines, closes `24_PERFORMANCE.md` §4 permanently.
3. **Playwright, three flows only**: place an order as a guest, place a booking,
   sign in and open `/activity`. Not a full suite — the three paths where a
   regression means lost money.
4. **jsdom + Testing Library for `ui/`.** Fifteen primitives, small surface,
   and it is where the accessibility contract lives.
5. **axe in CI** on the three Playwright flows.

---

## 2. Test plan per sector flow

Seventeen sectors are declared in `src/lib/sectors.ts:182–407`. Each row states
the flow, the code path that implements it, and the mark.

### 2.1 Retail / pharmacy / farm — browse → cart → checkout → order

**Supported.**

Path: `/store/[id]` → `store-products.tsx` → `place_customer_order`
(`store-products.tsx:545`) or `place_guest_order` (`:489`) →
`/orders/[id]` or `/track/[orderId]`.

Evidence it works today: 7 orders exist. `order-math.test.ts` covers the
arithmetic with 18 tests. Idempotency key per attempt (`store-products.tsx:264–266`),
server-authoritative totals, stock checks, coupon and loyalty capping.

| Case | Priority | Note |
|---|---|---|
| Guest order, cash on delivery, single item | P0 | the only path proven by production data |
| Signed-in order with coupon + loyalty redemption | P0 | capping is server-side; assert the client preview matches the RPC result |
| Double-tap / flaky-4G retry returns the **same** order | P0 | the idempotency key is the single most valuable untested guarantee in the app |
| Out-of-stock item raises `insufficient_stock:<name>` and the UI names the item | P1 | `store-products.tsx:226` |
| Multi-branch store: branch selection reaches the order | P1 | `store-products.tsx:271–273` |
| Delivery zone minimum blocks checkout | P1 | fee preview is display-only; the RPC re-resolves |
| Store with >1000 product variants | P2 | `24_PERFORMANCE.md` §4 #1 — currently impossible to hit, will be a wrong-variant bug |

### 2.2 Food — menu → modifiers → order

**Partially supported.**

Menu layout exists (`store-products.tsx:296–305`, the `menu` template).
`reservation-form.tsx` (194 lines) covers table booking. `order_items.note` is in
the model. The `kitchen` module exists for the merchant.

Gap: the prior audit specified modifiers in a bottom sheet and sticky menu
category tabs; `ui/bottom-sheet.tsx` now exists but the product page still uses
inline variant controls above ~6 options (open from the prior audit, `08_STORE_OFFERING_PAGES.md`).

| Case | Priority |
|---|---|
| Order with per-item note reaches the merchant | P0 |
| Modifier selection on a 10-option item at 360px | P1 — **needs a device** |
| Reservation → merchant `bookings` inbox | P1 |

### 2.3 Healthcare / beauty / petCare / professional — appointment booking

**Partially supported.**

Path: `booking-panel.tsx` (1,303 lines) → `place_booking`
(`booking-panel.tsx:488`). Availability rules, exceptions, waitlist and the
cancellation window all exist (`0174_booking_engine.sql`). Double-booking is
prevented at the database by unique indexes
(`0144_bookings_slot_conflict_guard.sql:10, 15, 20`; `0145:9`) **and** by GiST
exclusion constraints on overlapping ranges (`0174:75, 82`). That is a properly
guarded flow.

Two named gaps:

1. **There is no `/bookings/[id]`.** The activity centre is forced to link a
   booking card to the list (`src/lib/data/activity.ts:108`). A customer cannot
   deep-link to their own appointment.
2. **`sectorHasTeam()` routes beauty, fitness, education, petCare and
   professional through the `doctors` module** (`sectors.ts:271, 284, 310, 362,
   375`), which carries a `Stethoscope` icon. A salon's staff list is labelled as
   doctors.

| Case | Priority |
|---|---|
| Booking states clearly whether it is a **request** or a **confirmation** before confirm | P0 — the single most common booking confusion, per the prior audit |
| Cancellation window shown **before** the confirm button | P0 |
| Two customers taking the last slot: second gets a readable message, not a raw constraint error | P1 |
| Booking appears in `/activity` with the booking status vocabulary, not the order one | P1 |
| Provider availability exception hides the slot | P2 |

### 2.4 Services / contractors — service request

**Partially supported.**

Path: `service-request-form.tsx` (363) → `manage_service_request`
(`service-request-form.tsx:135`); merchant side `service-request-manager.tsx:71`.

Gaps: no `/crafts/requests/[id]`, so the activity card links to a list
(`activity.ts:129`). And the crafts vertical has a trust defect —
`craft_requests_update` has no `WITH CHECK`, so a customer can set their own
request to `completed` and thereby unlock a "verified" craft review
(`23_SECURITY_PRIVACY.md` §3.7).

| Case | Priority |
|---|---|
| Guest submits a request with address + photos; provider receives it | P0 |
| Customer **cannot** self-mark a request completed | P0 — currently they can |
| Customer cannot reassign a request to a different provider | P0 — currently they can |
| Anonymous request flood is rate-limited | P1 — currently it is not |

### 2.5 Crafts marketplace — find a tradesman

**Not supported.** `0 live craft providers` (`19_REMAINING_ISSUES.md`, data
prerequisites). Seven routes exist (`/crafts`, `/crafts/[trade]`, `/crafts/join`,
`/crafts/me`, `/crafts/p/[id]`, `/crafts/p/[id]/request`, `/crafts/requests`) and
none can return a result.

**Do not test this flow. Do not mark it passable.** It is a supply problem, not a
code problem, and running QA on it produces a green tick over an empty screen.

### 2.6 Real estate / automotive — listing → inquiry (lead)

**Partially supported.**

Path: `lead-form.tsx:51` → `create_lead`. This is the best-guarded guest write in
the app: an RPC with a five-per-phone-per-hour cap
(`0190_lead_engine.sql:98–104`), no insert policy at all. It is the pattern
`craft_requests` should copy.

Gap: the lead's status has **no Arabic labels**. `activity/page.tsx:41` passes
`lead: {}` and `dict.activity` has no lead status block, so an inquiry card
renders `new` / `contacted` / `closed` in English in an Arabic UI
(`16_CUSTOMER_EXPERIENCE.md` §5.1).

| Case | Priority |
|---|---|
| Guest inquiry reaches the merchant's Leads inbox | P0 |
| Sixth inquiry in an hour from one phone is refused, with a readable reason | P1 |
| Lead status renders in Arabic on `/activity` | P0 — currently fails |
| Listing filters are sector-appropriate (rooms for property, gearbox for cars) | P1 |

### 2.7 Hospitality — date-range stay booking

**Partially supported by code, unverifiable in practice.**

Path: `stay-search.tsx:83` → `place_stay_booking` (`0191_accommodation_engine.sql:152`).
Overlap is prevented by a GiST exclusion constraint (`0191:74`), which is the
correct mechanism. `sectorPrimarySetup()` (`sectors.ts:428`) correctly tells a
hotel to add **units**, not products.

The prior audit's own rule applies: *"flows for categories without live data
(hospitality, automotive) will be reported as unsupported, not as passed"*
(`17_E2E_RESULTS.md`). Nothing since has changed that, and this session could not
query the database to check.

**Mark: partially supported — test on a seeded staging store only, and label the
result as staging.**

### 2.8 Events — ticket purchase

**Partially supported.** `event-tickets.tsx:66` → `buy_tickets`
(`0193_event_tickets.sql:55`), which is an RPC and therefore atomic.
`sectorPrimarySetup()` routes events to `event_ticket_types`. No live data known.

### 2.9 Fitness — class booking — **the one with a real correctness defect**

**Partially supported, with a P0 bug.**

`classes-booking.tsx` reads `class_spots_taken` (`:88`) to re-check capacity and
then writes with a **direct table insert** (`:97`). `0130_store_classes.sql:5–6`
states the design explicitly: *"the booking path can re-check capacity before
inserting."*

There is **no database constraint on class capacity.** The unique indexes in
`0144` prevent one customer double-booking and prevent two customers taking the
same *resource* slot — they do not cap the number of bookings against a class,
because a class is meant to have many. So two customers hitting "book" on the
last spot within the same round trip both succeed, and the class is overbooked.

The same shape appears in `timeslot-booking.tsx:129–139` (sportsCourts) —
re-check then raw insert — but there it **is** guarded, by
`bookings_no_double_book_resource` (`0144:15`). So the second customer gets a
raw Postgres unique-violation surfaced through the generic error path rather
than "that slot was just taken". A UX defect, not a data one.

| Case | Priority |
|---|---|
| Two concurrent bookings for the last class spot | **P0 — expected to fail today** |
| Two concurrent bookings for the same court slot | P0 — expect a *readable* refusal, currently a raw error |
| Membership subscription (`join-action.tsx:59`) | P1 |

### 2.10 Education — course enrolment
**Partially supported.** `join-action.tsx:64` → `enroll_course`
(`0192_membership_enrollment.sql:92`). Same `doctors`-as-team labelling issue as
§2.3. No live data known.

### 2.11 sportsCourts — timeslot
Covered in §2.9.

### 2.12 Merchant operations — every sector

**Supported for orders; partially elsewhere.**

The merchant tab bar derives tabs from the store's sector
(`merchant-tab-bar.tsx`, `merchant-sidebar.tsx:299`). Whether it degrades
correctly for the sectors whose `daily` list does not split cleanly into
inbox + catalogue — `sportsCourts`, `events`, `professional` — **cannot be
verified from source** and needs one pass per sector on a phone.

| Case | Priority |
|---|---|
| Merchant tab bar renders correctly for **each of the 17 sectors** | P1 — 17 cases, device required |
| Staff without an `orders` permission does not see العمليات | P0 — the permission model has known holes (`23_SECURITY_PRIVACY.md` §3.3) |
| Badge counts come from real queries, not placeholders | P1 |
| Merchant header does not sit under the notch | P1 — `18_MOBILE_APP_EXPERIENCE.md` §4 |

### 2.13 Employee clock-in (WebAuthn)

**Supported, and the best-tested flow in the app** — 16 unit tests in
`attendance.test.ts`, rate limiting in `0264`, single-use challenges,
`userVerification: "required"`, cross-store device rejection
(`clock/punch/route.ts:94`).

| Case | Priority |
|---|---|
| Enrolment code is single-use and expires in 10 minutes | P0 |
| Sixth wrong code within 15 minutes locks the shop and **says so** | P0 — `0259` fixed a bug where the evidence rolled back |
| A device enrolled at shop A cannot punch at shop B | P0 |
| "Show my hours" does not consume a punch | P1 — `clock/punch/route.ts:129–138` |
| A staffer cannot read a colleague's live enrolment code | **P0 — expected to fail today** (`23_SECURITY_PRIVACY.md` §3.4) |

### 2.14 Digital goods download
**Supported.** Entitlement decided as the caller
(`download/[itemId]/route.ts:39`), signed URL minted second (`:64`). Private
bucket with no read policy. Test that a signed URL expires and that a
non-purchaser is refused.

### 2.15–2.17 Jobs / freelance / wholesale
**Not assessed.** Four routes each, no live-data evidence available from this
session. Do not schedule QA until row counts are known.

---

## 3. Cross-cutting test matrix

Run against every sector flow above, not per flow.

| Dimension | Cases |
|---|---|
| **Auth state** | guest · signed-in customer · store owner · staff with partial permissions · super admin |
| **Locale** | `ar` (RTL, default) · `en` (LTR) — every flow, both. The activity date bug (`activity-list.tsx:111`) is exactly what this catches |
| **Theme** | light · dark · system. The dark pass would have caught the 1.21:1 badge |
| **Viewport** | 320 · 360 · 375 · 390 · 414 · 768 · 1024 · 1440. **These are the eight the brief asks for and none was captured this session.** |
| **Delivery** | browser · installed PWA · Android Capacitor binary · iOS Capacitor binary (never built) |
| **Network** | online · offline (does `/offline.html` appear) · slow 4G |
| **Input** | touch · keyboard-only · screen reader (VoiceOver Arabic, TalkBack Arabic) |

---

## 4. Regression suite to build first

Ten checks. If only ten things are ever automated, these.

| # | Check | Type |
|---|---|---|
| 1 | Guest can place an order and sees the reference, total and next step | E2E |
| 2 | The same idempotency key returns the same order, not two | E2E |
| 3 | A booking cannot be double-booked | SQL |
| 4 | A class cannot be overbooked | SQL — **expected to fail today** |
| 5 | A staffer with `{"products":true}` cannot read `store_employees` | SQL — **expected to fail today** |
| 6 | `run_trial_maintenance` is not executable by `anon` | SQL — **expected to fail today** |
| 7 | Every `.select()` in `src/lib/data/**` has a `.limit()` or `.range()` | static |
| 8 | Every `SECURITY DEFINER` function in a new migration has a matching `REVOKE` | static |
| 9 | No raw Tailwind palette colour outside the allow-list | lint |
| 10 | axe reports zero serious violations on `/`, `/explore`, `/store/[id]` | E2E |

Four of the ten are expected to fail on the first run. That is the point of
writing them.

---

## 5. What could not be verified

- **Which sectors have live stores.** The production database could not be read
  from this session, so no sector is confirmed as having real data except by
  inference from the prior audit (crafts: 0 providers) and from the ground-truth
  counts (11 stores, 65 products, 7 orders, 22 bookings). The orders and bookings
  counts prove *some* retail/food and *some* booking sector is live; which ones
  is unknown here.
- Whether any flow above actually completes. Nothing was executed.
- Whether the class-capacity race and the resource-slot error message behave as
  reasoned. Both conclusions are drawn from schema and source, and both should be
  confirmed with the SQL tests in §4 before being treated as facts.
- The eight viewports. No screenshot was taken and none can be.
