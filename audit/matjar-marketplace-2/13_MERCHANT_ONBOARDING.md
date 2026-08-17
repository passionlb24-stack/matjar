# 13 — Merchant Onboarding

Walked from the actual routes and components. Production data read read-only
from `wesihatopiznatsyfxer` during this audit.

---

## 1. The real flow, step by step

### Step 1 — `/[lang]/(dashboard)/merchant/new`

`src/app/[lang]/(dashboard)/merchant/new/page.tsx` (76 lines) does three things:
require a logged-in user, load **every** row from `business_types`, and render
`<StoreForm>`.

The whole of onboarding is `src/components/store-form.tsx` (242 lines). One
screen, one submit button. Fields in the order the merchant meets them:

| # | Field | Column | Required? | Notes |
|---|---|---|---|---|
| 1 | Store name | `name` | **yes** (`store-form.tsx:63-68`) | also auto-derives the vanity slug |
| 2 | Custom link | `slug` | no | prefixed `matjarlb.com/`, latin-only; Arabic-only names produce an empty suggestion |
| 3 | Business type | `business_type_id` | **yes** (`store-form.tsx:69-74`) | `<optgroup>` by top-level group |
| 4 | Region | `region` | no | 5 Lebanese regions from `src/lib/catalog.ts` |
| 5 | Area | `area` | no | free text |
| 6 | Phone | `phone` | no | |
| 7 | WhatsApp | `whatsapp` | no | |
| 8 | Description | `description` | no | 3-row textarea |

Two fields are required. Everything else can be skipped, and a store created
with nothing but a name and a type is a valid row.

On submit (`store-form.tsx:75-89`) the client inserts straight into `stores` and
then **`router.push('/${lang}/merchant')`** — back to the store *list*, not into
the store that was just created.

### Step 2 — what the database does silently

Triggers on `stores` INSERT, in production (`information_schema.triggers`):

- `stores_grant_trial` → `grant_store_trial()` — sets `trial_ends_at`, so the
  merchant is on a 14-day Pro trial they were never told about on this screen.
- `stores_validate_slug` → format/reserved-word check.
- `stores_create_primary_location` → seeds `store_locations` (33 rows in prod,
  one per store).
- `trg_promote_store_owner` → `promote_store_owner()` (`0182`) — the account's
  role becomes `merchant`.
- `stores_on_new` → `on_new_store()` (`0078`) — writes a `store_new`
  notification to **every** `super_admin`, which `push_on_notification()` turns
  into a push: "متجر جديد بانتظار المراجعة 🏪".

`stores.status` defaults to `'pending'` (`0003_stores_and_business_types.sql:38`),
and the public read policy is `status = 'active' and deleted_at is null`
(`0003:89`). So at this moment the store exists and is invisible.

### Step 3 — the list screen

`src/app/[lang]/(dashboard)/merchant/page.tsx` renders the new store as a card
with a status pill (`merchant/page.tsx:169-173`, styled amber for `pending` at
line 19). Above it, a `PushNotice` asks for notification permission with the
reasoning quoted in the code comment at lines 125-127 — that is a genuinely good
piece of design.

But the pill is the **only** thing on this screen that explains the state.
`dict.merchant.status.pending` is a single word. There is no "what happens
next", no "how long", no "what we check".

### Step 4 — `/merchant/[storeId]` (the OS home)

This is where onboarding actually resumes, and it is much better:

- `isPending` (`merchant/[storeId]/page.tsx:135`) replaces the "View public
  page" link with a warning chip (lines 895-899) and replaces the QR/share card
  with an explanatory block (lines 946-957). The comments at 890-894 and 942-945
  explain why: a merchant who printed a QR for an unapproved store had no way to
  find out it pointed at a 404.
- `<StoreChecklist>` (lines 919-931) is the coaching surface. 8 items, progress
  bar, per-item "Fix" deep-link, and a celebratory "your store is ready — share
  it" card at 100 % (`src/components/store-checklist.tsx:83-112`).

### Step 5 — approval

`/admin/stores` → `src/components/admin-stores-client.tsx`. A super-admin
approves or rejects. `stores_on_status_change` (`0271`) then notifies the owner
— "تمت الموافقة على متجرك 🎉" — which closes a real gap that existed until
migration 271.

---

## 2. What the checklist actually asks

`src/components/store-checklist.tsx:60-73`, state computed at
`merchant/[storeId]/page.tsx:575-587`:

| item | source | destination |
|---|---|---|
| logo | `stores.logo_url` | `/edit` |
| cover | `stores.cover_url` | `/edit` |
| description | `stores.description` | `/edit` |
| hours | `parseHours(stores.hours)` — the structured grid, not the retired free-text box | `/edit` |
| whatsapp | `stores.whatsapp` | `/edit` |
| products | `count(products) >= 3` | `/items` |
| brand colour | `stores.accent_color` | `/edit` |
| custom link | `stores.slug` | `/edit` |

Sector awareness is one narrow override. `sectorPrimarySetup()`
(`src/lib/sectors.ts:425-433`) swaps the "products" row for "add a unit"
(hospitality → `accommodation_units`) or "add ticket types" (events →
`event_ticket_types`). **Two sectors out of seventeen.** Everything else is
identical for a butcher, a lawyer, a padel court and a real-estate agent.

---

## 3. Where a merchant is left stuck

### 3.1 The handover after submit is the weakest moment in the product

The merchant fills a form, presses "Create", and is dropped on a list with an
amber word. The screen that explains pending status, the checklist, and the
"what to do while you wait" is one click further in and nothing tells them to
take that click. `store-form.tsx:110` is a one-line fix: push to
`/${lang}/merchant/${created.id}` instead of `/${lang}/merchant`.

### 3.2 "Add 3 products" is the wrong ask for most sectors

The generic step fires for 15 of 17 sectors. From `src/lib/modules.ts`
(`categoryModule`), 11 of 17 sectors are `kind: "booking"` and 8 of those carry
`simplifiedItem: true` — their `items` are services, not stock. Telling a lawyer
or a padel court "add 3 products" is not merely awkward, it is the platform
asking for the wrong object. Meanwhile:

- `healthcare`, `beauty`, `fitness`, `education`, `petCare`, `professional` all
  declare `team` in `sectorConfig[...].features` and have a `doctors` module in
  their daily group. **A clinic with no practitioners is never nudged to add
  one.**
- `sportsCourts` needs `store_resources` (2 rows platform-wide). Not in the
  checklist.
- `fitness` / `education` need `store_membership_plans` / `store_courses`
  (2 and 2 rows). Not in the checklist.
- `services` and `contractors` declare `portfolio`. `store_portfolio` has
  **0 rows**. Not in the checklist.

### 3.3 Location is a default module for most sectors and is never asked for

`location` appears in `features` for 13 of the 17 sectors in `sectors.ts`. It is
not on the checklist, not on `/merchant/new`, and lives only in `/edit`
(`lat`/`lng` are in that page's select list) and `/settings`.

Production, `stores` where `deleted_at is null`:

| | count |
|---|---|
| stores | 33 |
| with `lat` **and** `lng` | **7** |
| active stores | 13 |
| active stores with coordinates | **5** (4 retail, 1 services) |

Every "near me" and distance feature the platform ships is dark for 8 of 13 live
stores, and no merchant has ever been asked to fix it.

### 3.4 Verifications are invisible to the merchant who most needs them

Six sectors carry `verifications` in their default bundle: `services`,
`healthcare`, `education`, `pharmacy`, `professional`, `contractors`. The page
exists (`/merchant/[storeId]/verifications`), is owner-only
(`OS_MODULE_META.verifications.ownerOnly`), and sits in the sidebar's "store"
group — the pinned-bottom, settings-shaped part of the nav.

Production: `store_verifications` = **0 rows**, `store_verification_docs` = **0
rows**. A pharmacy or a clinic is never told that presenting a licence is a
thing this platform can do, so nobody has.

(See `12_REVIEWS_TRUST.md` §4 — the table also has a live self-verification
hole. Fix that before promoting the feature.)

### 3.5 Business hours are asked for nowhere at creation

`hours` is on the checklist and in `/edit`, but not on `/merchant/new`. A store
approved without hours shows no open/closed state on its public page. 17 of 33
stores have structured hours.

### 3.6 The sector list is filtered by a rule the create form does not state

`merchant/new/page.tsx:36-39` loads business types with
`.select("id, slug, name_ar, name_en").order("sort_order")` — **no `is_active`
filter**, and the edit page (`edit/page.tsx:66-69`) is the same. The filtering
happens anyway, in RLS:

```
business_types_select  SELECT  to public
  USING ((is_active = true) OR is_super_admin())
```

So the outcome is right — a merchant is not offered a deactivated sector — but
nothing in the create form says so, and a super-admin creating a store sees a
different list from everyone else. More importantly, the same policy makes the
`business_types(slug)` embed return `null` for existing stores of a deactivated
sector, and every call site falls back to `?? "retail"`. See
`19_SUPER_ADMIN_SECTOR_ENGINE.md` §1.2a — that is the serious half.

### 3.7 The trial starts and nobody says so

`stores_grant_trial` sets `trial_ends_at` on INSERT. The merchant is not told on
the create form, not told on the list screen, and only meets it as an alert on
the OS home in the **last 3 days** (`merchant/[storeId]/page.tsx:504-522`). A
merchant whose store sat in `pending` for a week has burned trial days on a
store nobody could see.

### 3.8 Error handling is good; empty-state guidance is not

`store-form.tsx:90-108` maps `stores_slug_unique`, `slug_reserved`,
`slug_invalid` and generic `23505` to distinct human messages. That is careful
work. The contrast is that everything *before* an error — what a good store name
is, why the custom link matters, what the description is used for — has no
guidance at all beyond placeholder text.

---

## 4. Sector-specific onboarding needs vs. what is asked

Derived from `sectorConfig[...].features` and `modules.daily` in
`src/lib/sectors.ts`, plus `categoryModule` in `src/lib/modules.ts`.

| Sector | First thing that must exist before it can transact | Asked at `/new`? | On the checklist? |
|---|---|---|---|
| food | menu items; delivery zones or pickup | no | generic "3 products" |
| retail | products with stock | no | generic ✔ (fits) |
| services | services + portfolio; service area | no | generic (wrong noun) |
| healthcare | practitioners (`team`), specialties, licence | no | **no** |
| realEstate | listings with attributes; map pin | no | generic (wrong noun) |
| automotive | listings; lead-capture — no cart at all | no | generic (wrong noun) |
| beauty | services + team + booking slot length | no | **no** |
| fitness | membership plans / classes + team | no | **no** |
| sportsCourts | bookable resources (courts) + slot length | no | **no** |
| education | courses + tutors | no | **no** |
| events | ticket types | no | **yes** — `sectorPrimarySetup` |
| hospitality | accommodation units | no | **yes** — `sectorPrimarySetup` |
| pharmacy | products + licence | no | generic ✔ (partly fits) |
| petCare | services + team | no | **no** |
| professional | services + licence/credential | no | **no** |
| contractors | portfolio + service area + licence | no | **no** |
| farm | products | no | generic ✔ (fits) |

Read plainly: **the checklist is right for 3 sectors (retail, farm, food),
partly right for pharmacy, correct-by-override for 2 (events, hospitality), and
wrong for the remaining 11.**

---

## 5. What already exists and should not be rebuilt

Being precise about this matters, because the brief assumes less exists than
does:

| capability | state |
|---|---|
| Completeness checklist with progress and deep links | **exists** — `store-checklist.tsx` |
| Celebratory "ready, now share it" state | **exists** — same file, lines 83-112 |
| Sector-aware primary-setup step | **exists but covers 2 sectors** — `sectorPrimarySetup()` |
| Pending-state honesty on the OS home | **exists**, and is well reasoned |
| Approval / rejection notification to the owner | **exists** — `0271` |
| Rule-based suggestion engine on the OS home | **exists** — `page.tsx:612-650`, 5 rules |
| Sector-ordered dashboard widgets | **exists** — `WIDGET_ORDER`, `page.tsx:68-80` |
| Sector-derived phone tab bar | **exists** — `layout.tsx:186-256` |
| Per-store module toggles | **exists** — `/modules` + `store_modules` (7 rows) |
| Onboarding *wizard* (multi-step, sector-branching) | **missing** |
| Any completeness *score* | **missing** (the checklist's `pct` is a local render value, never persisted, never read by admin or by ranking) |
| Sector-specific required fields | **missing** |
| Guidance copy / coaching text | **missing** — only labels |

---

## 6. Recommendations, in the order they pay off

1. **Redirect to the new store, not the list** (`store-form.tsx:110`). One line.
   It puts the merchant on the only screen that explains what happens next.
2. **Make the checklist sector-aware for all 17 sectors**, not 2. Generalise
   `sectorPrimarySetup()` from a single override into a per-sector list of setup
   steps. `sectors.ts` already declares enough (`features`, `modules.daily`,
   `flow.itemsKey`) to derive most of it. See `14_PROFILE_COMPLETENESS.md`.
3. **Add the map pin to the checklist** for the 13 sectors carrying `location`.
   This is the single largest measurable gap in live data (7 of 33 stores, 5 of
   13 active).
4. **Split `/merchant/new` into two screens**: (a) identity — name, type,
   region, area; (b) a sector-branched "what does your business need" screen
   derived from `sectorConfig`, asking for the 2-3 things that sector cannot
   transact without. Keep both screens skippable, and let the checklist carry
   whatever was skipped. Do not build a 6-step wizard — the current one-screen
   form has a real virtue, which is that a merchant can finish it.
5. **Say what "pending" means** on both the list card and the OS home: what is
   checked, roughly how long, and that they can keep setting up meanwhile.
6. **Make the `is_active` filter explicit** in `/merchant/new` and `/edit`
   rather than leaving it to RLS, and fix the `?? "retail"` fallback that
   silently reclassifies existing stores of a deactivated sector.
7. **Surface verifications to the six sectors that declare them** — after the
   `store_verifications.status` hole is closed.
8. **Start the trial on approval, not on insert** (or pause it while `pending`).
   As written, `grant_store_trial()` charges the merchant's trial for the time
   the platform spends reviewing them.

---

## Could not verify

- No merchant interviews, no funnel instrumentation, no drop-off data. `hub_tool_events`
  and `store_visits` exist but I did not find any event recording form
  abandonment on `/merchant/new`, so how many merchants start and do not finish
  is unknown and is not guessed at here.
- 20 of 33 stores are `suspended` and 0 are `pending` or `rejected`. Whether
  those 20 are abandoned signups, test data, or admin-suspended real shops
  cannot be told from the schema — `stores` records no suspension reason and no
  status history. That is itself a finding, and it is picked up in
  `15_PUBLISH_READINESS.md`.
