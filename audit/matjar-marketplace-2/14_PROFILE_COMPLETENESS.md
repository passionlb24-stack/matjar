# 14 — Profile Completeness

Companion file: `PROFILE_COMPLETENESS_MATRIX.csv` (all 17 sectors, field by
field).

---

## 1. State today: no completeness score exists

Said plainly, because the brief assumes less and more than is true at the same
time.

**What exists:** a checklist. `src/components/store-checklist.tsx` renders 8
fixed rows with a progress bar. Its state is assembled inline on the OS home at
`src/app/[lang]/(dashboard)/merchant/[storeId]/page.tsx:575-587`:

```ts
const checklist: ChecklistState = {
  logo: !!s.logo_url,
  cover: !!s.cover_url,
  description: !!s.description?.trim(),
  hours: !!parseHours(s.hours),
  whatsapp: !!s.whatsapp?.trim(),
  products: itemsCount >= 3,
  brandColor: !!s.accent_color,
  customLink: !!s.slug,
};
```

**What does not exist:**

- No score is **stored**. `pct` is computed at line 75 of the component from
  `done / items.length`, rendered, and thrown away on every request.
- No score is **read** by anything else. Grepping `src/` finds no consumer:
  ranking (`src/lib/data/stores.ts`), admin (`/admin/stores`), publish gating
  and search all ignore it.
- No **weights**. All 8 items count equally, so a brand colour is worth as much
  as having anything to sell.
- No **sector variation**, except one binary override — `sectorPrimarySetup()`
  (`src/lib/sectors.ts:425-433`) swaps the "products" row for units
  (hospitality) or ticket types (events). 2 sectors out of 17.
- No **coaching copy**. The dictionary keys under `merchant.checklist.*` are
  labels ("Logo", "Cover"), not explanations. Nothing tells a merchant *why* a
  cover image matters or what a good one looks like.
- No **admin view** of completeness. `/admin/stores` shows name, type, owner,
  status, plan, badges — nothing about whether the store is actually finished.

So: **there is a nudge, there is no scoring model.** The nudge is a decent
starting point and should be evolved rather than replaced — it already has the
deep-link-per-item pattern and the "you're done, now share it" ending, both of
which are the right shape.

### What the absence costs, in live numbers

Production (`stores` where `deleted_at is null`, read during this audit):

| | all 33 | 13 active |
|---|---|---|
| logo | 14 | 11 |
| cover | 14 | 11 |
| description | 26 | 13 |
| structured hours | 17 | 11 |
| whatsapp | 32 | 13 |
| custom link (`slug`) | 25 | 11 |
| **map pin (`lat` + `lng`)** | **7** | **5** |
| accent colour | 8 | 5 |

The fields the checklist nudges hardest (logo, cover, hours, custom link) sit at
11/13 on live stores — the nudge works. The one field it does **not** mention,
the map pin, sits at 7/33 and 5/13 — and `location` is a default feature module
for 13 of the 17 sectors. That contrast is the argument for this whole document:
what the checklist asks for gets done, what it omits does not.

---

## 2. Design principles for the score

Three rules, all of which the current checklist breaks:

**A field earns a place on the checklist only if a customer can tell it is
missing.** A merchant should never be nagged for platform bookkeeping. Every row
in the matrix carries a `customer_visible` flag for this reason. Anything marked
`no` may still be scored, but it must never be the thing shown at the top of the
list.

**Weight follows consequence, not effort.** "No products" and "no brand colour"
are both one checkbox and are not remotely the same problem. Weights in the
matrix sum to 100 per sector, with the sector's primary catalog entity carrying
12-24 points and cosmetic fields carrying 2-4.

**The score is sector-shaped, and the sector already declares its own shape.**
`sectorConfig[category].features` (`src/lib/sectors.ts:182-407`),
`modules.daily`, and `categoryModule[category].itemsKey`
(`src/lib/modules.ts`) between them already say whether a sector books, sells,
or lists; whether it has a team; whether it has a portfolio. The completeness
model should be derived from those, not from a second parallel table of truth
that will drift.

---

## 3. The model

### 3.1 Field groups

Every sector's score is built from three groups:

| group | share | contents |
|---|---|---|
| **Identity** | 34 pts | logo (10), cover (8), description (10), brand colour (2), custom link (4) |
| **Reachability** | 32 pts | hours (8), whatsapp (8), phone (4), region + area (4), map pin (8) |
| **Sector core** | 34 pts | 1-3 fields, entirely sector-determined — see the CSV |

The 66-point common block is identical for all 17 sectors, so the scoring code
is one function plus a table lookup, not seventeen branches.

### 3.2 Where the sector core comes from

Derived, not hand-written, wherever `sectors.ts` already knows:

| signal already in code | drives |
|---|---|
| `categoryModule[c].itemsKey` (`menu` / `products` / `services` / `listings`) | the noun and the deep-link for the primary catalog step |
| `sectorPrimarySetup(c)` | hospitality → `accommodation_units`, events → `event_ticket_types` (**generalise this from 2 sectors to a per-sector table**) |
| `sectorHasTeam(c)` — `features.includes("team")` | the "add your practitioners" step for healthcare, beauty, fitness, education, petCare, professional |
| `features.includes("portfolio")` | the "show your work" step for services, contractors |
| `features.includes("verifications")` | the licence step for services, healthcare, education, pharmacy, professional, contractors |
| `features.includes("location")` | whether the map pin is *required* rather than merely scored |
| `features.includes("memberships" \| "classes" \| "courses" \| "timeslot")` | fitness, education, sportsCourts core entities |

The one thing `sectors.ts` does not know is which of these are **required to
publish** versus merely scored. That is a judgement, and it belongs in one
explicit per-sector table — see `15_PUBLISH_READINESS.md` §3 and the
`required_for_publish` column of the CSV.

### 3.3 Score bands and what each one does

| score | band | behaviour |
|---|---|---|
| 0-39 | **Getting started** | checklist expanded, shown at the top of the OS home (where it is today) |
| 40-69 | **Nearly there** | checklist collapses to the top 3 remaining items, ranked by weight |
| 70-89 | **Good** | one line: "Your page is in good shape — N things left", expandable |
| 90-100 | **Complete** | today's celebratory share card (`store-checklist.tsx:83-112`), which already exists and is the right ending |

Note the change: today the celebration fires only at **100 %** of 8 items. A
merchant who has done everything meaningful but not picked a brand colour never
sees it. 90 is the right threshold, and the remaining items should keep being
reachable from the collapsed state.

### 3.4 Storage

Store the score, don't just render it:

- `stores.completeness_score smallint not null default 0` and
  `stores.completeness_computed_at timestamptz`.
- Recomputed by a `SECURITY DEFINER` function on the writes that can move it
  (store update; insert/delete on the sector core table). This is exactly the
  pattern `sync_store_rating()` already uses (`0091`) and it is the reason that
  migration exists — a denormalised value that a trigger keeps honest.
- Why store it: so `/admin/stores` can sort by it, so publish readiness can gate
  on it, and so ranking can (optionally, cautiously) prefer complete stores.

That last one deserves a warning. Do **not** let completeness silently outrank
relevance in search. A well-photographed shop that sells the wrong thing is
still the wrong result. Use it as a tie-breaker at most, and say so in the code.

---

## 4. Coaching, not nagging

This is where the current design is weakest, and it is entirely a copy problem —
the mechanics are already there.

**Every field needs three strings, not one label:**

| key shape | example (`cover`) |
|---|---|
| `merchant.coach.<field>.label` | "Cover photo" *(exists today)* |
| `merchant.coach.<field>.why` | "Your cover is the first thing someone sees in search results. Shops with one get opened more often." |
| `merchant.coach.<field>.how` | "A wide photo of your shopfront or your best shelf. Landscape, not portrait." |

The `coaching_message_key` column in the CSV names the key stem for each field.

**Rules for the copy:**

1. **Say the consequence, not the requirement.** "Customers can't find you on
   the map" beats "Location incomplete".
2. **Never count down.** "3 of 8 done" reads as a debt. "Your page is ready to
   share — two more things would help" reads as progress. The percentage can
   stay; the framing around it must change.
3. **Show at most three items at a time** once the score is above 40. The
   full 8-12 row list is honest and demoralising; the top three by weight is
   honest and actionable.
4. **Never nag for a field the merchant cannot supply.** A store with no
   physical premises (some `professional`, some `services`) should be able to
   answer "I don't have one" and have the field removed from *their* denominator
   rather than sitting red forever. The matrix marks these `customer_visible=no`
   or `required_for_publish=no`; an explicit dismissal needs a small
   `store_checklist_dismissed` table or a jsonb column on `stores`.
5. **One nudge per session, in one place.** Today the OS home shows the
   checklist *and* a suggestions card (`page.tsx:612-650`) that can also say
   "finish your checklist" (`suggestChecklist`). Two nudges for the same thing
   on one screen is nagging by accident. The suggestions card should drop that
   rule once the checklist is sector-aware.
6. **Arabic first.** These strings will be read overwhelmingly in Lebanese
   Arabic; write them there and translate to English, not the other way around.
   The existing dictionary discipline (`src/i18n/dictionaries/{ar,en}.json`)
   already supports this.

---

## 5. Reading the CSV

`PROFILE_COMPLETENESS_MATRIX.csv`, columns exactly as specified:

| column | meaning |
|---|---|
| `sector` | one of the 17 `CategoryKey`s in `src/lib/sectors.ts` |
| `field` | stable field id; matches the schema column or table it reads |
| `weight` | points out of 100 for that sector; each sector's rows sum to 100 |
| `required_for_publish` | `yes` = the store cannot reach `READY_FOR_REVIEW` without it (see `15_PUBLISH_READINESS.md`) |
| `customer_visible` | `yes` = a shopper can tell it is missing |
| `coaching_message_key` | dictionary key stem; `.label` / `.why` / `.how` hang off it |
| `exists_today` | `yes` = in schema **and** on the current checklist; `partial` = in schema/UI but never scored or nudged; `no` = the merchant has no way to supply it |
| `notes` | the specific table/column/file, and why |

Counts across the matrix: **17 sectors, 221 rows, 12-14 fields per sector**, and
every sector's weights sum to exactly 100. `exists_today=yes` applies to the 6
checklist-backed common fields plus the primary catalog for 5 sectors;
everything else is `partial` (schema exists, never scored) or `no` (genuinely
new work — 5 rows).

---

## 6. Fields that are `no` today — new work, flagged honestly

| field | sectors | why it is `no` |
|---|---|---|
| `service_area` | services, contractors | Service areas exist **only** for craftsmen (`craft_provider_areas`, `lb_areas`, migrations `0235`/`0236`). `stores` has no equivalent — a plumber registered as a `contractors` store cannot say which towns they cover. |
| `stock_or_availability` | retail | `products.stock` exists, but there is no "is this shop actually in stock" signal, and **0 of 65 products carry a cost price** (`products.cost`, `0210`), so margin-aware coaching is impossible today. |
| `lead_contact` | realEstate, automotive | The `leads` module exists (3 rows) but there is no per-store declaration of how a lead should reach them. |

Everything else marked `partial` has schema and a page behind it; it simply is
not scored or nudged. Those are cheap. The three above are genuinely new.

---

## 7. Sequencing

1. **Add the map pin to the existing 8-item checklist.** One row, biggest
   measurable gap (5/33), zero new schema.
2. **Generalise `sectorPrimarySetup()`** from a 2-sector special case into a
   per-sector table of core setup steps. This alone fixes the "add 3 products"
   nonsense for 11 sectors.
3. **Add weights and bands** — still no persistence, still one component.
4. **Write the `why`/`how` coaching copy**, Arabic first.
5. **Persist `completeness_score`** with a trigger, and surface it in
   `/admin/stores`.
6. **Only then** consider using it in ranking or publish gating.

Steps 1-2 are days of work against code that already exists and would fix the
majority of the real complaint. Steps 5-6 are where a schema change is finally
justified.

---

## Could not verify

- Field-level impact on conversion. `store_visits` (migration `0167`) records
  visits and `store_visits_summary` aggregates them, but nothing joins visit or
  order data to profile completeness, so **no claim is made here that any
  specific field increases sales.** The weights in the CSV are reasoned from
  what a shopper can see and what blocks a transaction, not measured. They
  should be revisited once there is data.
- Whether the 20 `suspended` stores are abandoned incomplete signups. Their
  completeness looks poor in aggregate (2/20 have logos), which is suggestive,
  but `stores` records no suspension reason and no status history, so the
  causation cannot be read.
