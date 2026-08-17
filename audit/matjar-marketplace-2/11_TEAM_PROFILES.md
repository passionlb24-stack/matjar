# 11 — Team Profiles

---

## 1. A correction to the framing

The task framed `store_staff` and `doctors` as "two parallel implementations of the same idea". **They are not.** Reading both schemas and their policies shows two tables that answer different questions, and a third table whose migration explicitly documents that distinction.

| Table | Question it answers | Key evidence | Rows in prod |
|---|---|---|---|
| `store_staff` | *Who may log in and operate this store's dashboard?* | `user_id` is `not null` and FKs to `profiles`; `permissions jsonb` (`0024_staff_permissions.sql:3-5`); underpins `can_manage_store()` (`0018_store_staff.sql:30-36`) and `staff_can()` (`0024:7-28`) | 1 |
| `doctors` | *Who does the customer choose when booking?* | No `user_id` at all; carries `specialty`, `photo_url`, `bio`, `sort_order` (`0026_healthcare_doctors.sql:4-14`); public-read RLS for active stores (`0026:24-32`) | 2 |
| `store_employees` | *Who is on the payroll?* | `user_id` nullable, `pay_basis`, `pay_rate`, `pay_currency`, `residency_expires_on`, `pin_hash` (`0254_hr_employees_and_attendance.sql:12-41`) | — |

`0254:3-11` states the separation in as many words:

> "An employee is a record, not a login. `store_staff` already exists and is the wrong thing for this: it needs an email and a platform account, because it grants dashboard access. A butcher with six workers … is not going to create six Matjar accounts."

So the platform already reasoned its way to three distinct person-concepts — **access grant**, **public provider**, **payroll record** — and got that reasoning right. Merging them would be a regression, not a consolidation.

**There is, however, a real naming and reach problem, and it is on `doctors`.**

---

## 2. `doctors` is already the generic team engine — it is only misnamed

`0146_service_providers_join.sql:1-5` says so directly:

> "Links a service (product) to the provider(s) who deliver it — **generalizes the clinic 'doctor' idea to every service sector** (stylist, technician, trainer, teacher…)."

And the code follows through. `doctors` is not a healthcare table with healthcare wiring; it is a provider table wearing a healthcare name:

- **Cross-sector gating.** `sectorHasTeam()` (`sectors.ts:438-440`) returns true for any sector whose bundle contains `team` — `healthcare` (`:224`), `beauty` (`:266`), `fitness` (`:279`), `education` (`:305`), `petCare` (`:357`), `professional` (`:370`). Six sectors. The public page fetches from `doctors` for all six (`page.tsx:272-278`) and the merchant page is gated the same way (`merchant/[storeId]/doctors/page.tsx:58`).
- **Provider↔service assignment.** `service_providers(product_id, doctor_id)` many-to-many, with "no rows means any provider can deliver it" as the backward-compatible default (`0146:4-5`, honoured at `page.tsx:279-290`).
- **Per-provider availability.** `provider_availability_rules` (weekday, start, end) and `provider_availability_exceptions` (day-off dates) — `0174_booking_engine.sql:36-63`, read at `merchant/[storeId]/doctors/page.tsx:97-111`, edited by `components/provider-hours.tsx`.
- **Booking-level integrity.** `bookings.doctor_id` (`0088_resource_scoped_bookings.sql:8`), a partial unique index preventing double-booking a provider (`0144_bookings_slot_conflict_guard.sql:11-12`), and a GiST exclusion constraint on overlapping ranges per provider (`0174:75-76`), plus a check that `allocation_mode = 'provider_exclusive'` requires a provider (`0174:83`).

That is a more complete scheduling model than most booking products ship with. The problem is not that it lacks reach — it is that **a gym owner adding a personal trainer navigates to a page called "Doctors"**, and the merchant UI (`components/doctor-manager.tsx:18-32`) offers exactly `name`, `specialty`, `photo_url`, `bio` — a clinical field set for six different professions.

---

## 3. What the public team surface actually shows

`store/store-doctors.tsx:13-63`, rendered at `page.tsx:704`:

- Photo (56px, `next/image`, `alt=""` at `:34` — **a person's photograph marked decorative**)
- Name (`:46`)
- Specialty (`:48-51`)
- Bio (`:52-56`)

That is the entire team profile. Missing:

| Absent | Why it matters | Where the data could come from |
|---|---|---|
| **Position on the page** | Renders at slot 19 of 21, *below* the whole offering list, for `healthcare` and `beauty` where the practitioner is the choice being made | Ordering fix in `04`/`05` |
| **Per-provider CTA** | The card is inert. The provider picker exists only inside `BookingPanel` (`store-products-section.tsx:107-112`) — the customer must scroll back up and re-find the person | `service_providers` already knows which services each provider delivers |
| **Which services they deliver** | Already stored in `service_providers`, already fetched at `page.tsx:280-283`, and never shown on the card | zero new schema |
| **Availability signal** | `provider_availability_rules` gives exact per-provider hours; the card shows none of it, not even "available today" | zero new schema |
| **Credentials / licence** | The trust question for `healthcare` and `professional`. `store_verifications` is store-level only | new: `provider_verifications` or a `provider_id` on the existing table |
| **Languages spoken** | A genuine filter in Lebanon (Arabic / French / English / Armenian) | new column |
| **Years of experience** | `craft_providers.years_experience` (`0238:37`) already models it for the crafts directory | new column, copy the existing shape |
| **Per-provider reviews** | Reviews are store-level only (`0009_reviews.sql:2-13`, unique per store+customer). A five-star clinic tells you nothing about the doctor you booked | new: `reviews.provider_id` |

---

## 4. A fourth person model exists

`craft_providers` (`0238_craft_providers_standalone.sql:26-48`) is a person-as-a-business: `kind ('individual'|'business')`, `name`, `headline`, `bio`, `photo_url`, `phone`, `whatsapp`, `years_experience`, `region`, `area_id`, `hours jsonb`, `status ('pending'|'active'|'suspended'|'rejected')`, `verified`, `rating_avg`, `rating_count` — with `craft_services` (per-provider priced services, five pricing types) and `craft_works` (photographed past jobs) hanging off it.

The migration's own reasoning (`0238:3-9`) is that a tradesman should not have to "open a store" to say he is an electrician. That is a sound product call and is **not** the same object as a store's provider roster.

But note what `craft_providers` has that `doctors` does not: a headline, years of experience, a verification flag, a rating, a status/review queue, service areas, and a portfolio. **The richer team profile the brief is asking for already exists in this codebase — for a different entity.** The design work is largely done; it needs porting, not inventing.

---

## 5. The recommended team engine

**One engine, built by evolving `doctors` — not by merging tables.**

### 5.1 Rename to `store_providers`

```sql
alter table public.doctors rename to store_providers;
create view public.doctors as select * from public.store_providers;  -- compatibility
```

The view keeps `from("doctors")` reads working during migration. It does **not** keep FK column names working — `service_providers.doctor_id`, `bookings.doctor_id`, `provider_availability_rules.doctor_id`, `provider_availability_exceptions.doctor_id` all stay named `doctor_id` unless separately renamed. **Recommendation: rename the table, leave the FK columns alone for now.** They are internal; the table name is what merchants see in URLs and page titles.

### 5.2 Add the profile depth (all nullable, no backfill)

```sql
alter table public.store_providers
  add column if not exists role_title      text,     -- sector-neutral; "specialty" stays as an alias
  add column if not exists headline        text,
  add column if not exists years_experience int check (years_experience is null or years_experience between 0 and 70),
  add column if not exists languages       jsonb not null default '[]'::jsonb,
  add column if not exists active          boolean not null default true,
  add column if not exists public_visible  boolean not null default true;
```

`public_visible` is the privacy lever §6 needs. `active` matters because there is no soft-delete today — removing a provider from the roster deletes the row, and `bookings.doctor_id` is `on delete set null` (`0088:8`), so a store's booking history loses its provider attribution the moment someone leaves.

### 5.3 Sector vocabulary, from the registry

`SectorConfig` already carries `customersNoun: "customers"|"patients"|"clients"|"leads"` (`sectors.ts:163`) and uses it for OS vocabulary. Add the mirror:

```ts
providerNoun: "doctor" | "stylist" | "trainer" | "tutor" | "agent" | "specialist" | "provider"
```

- `healthcare` → `doctor` · `beauty` → `stylist` · `fitness` → `trainer` · `education` → `tutor` · `petCare` → `vet` · `professional` → `specialist`
- `realEstate` would take `agent` — but `realEstate` does **not** have `team` in its bundle (`sectors.ts:237`). Adding it is a separate decision; the brief names agents, and today they have no home.

This kills the "Doctors" heading in a gym dashboard with a dictionary lookup and no schema change.

### 5.4 Fix the override bug

`sectorHasTeam()` (`sectors.ts:438-440`) reads `sectorConfig[category].features` directly. The public page (`page.tsx:272`) and the merchant page (`merchant/[storeId]/doctors/page.tsx:58`) both call it, so **a store that switches `team` off in the modules manager still renders its roster**. Every other module honours the store override via `resolveStoreModules`. This is a one-line inconsistency with a real effect on merchant trust in the toggles.

### 5.5 Extend reach

`team` is in six of 17 bundles. Sectors with a plausible roster and no `team` today: `services` (technicians), `contractors` (crew leads), `realEstate` (agents), `hospitality` (concierge — weak), `automotive` (sales staff — weak). Adding `team` to `services` and `contractors` costs nothing (the module resolves, the section renders when rows exist, `emptyBehaviour: "hide"`).

---

## 6. Sector privacy and legal differences

These are not cosmetic and they are the reason a single unmoderated "team" section is the wrong answer.

**`healthcare` and `petCare` — regulated practitioners.**
A doctor's name, photograph, specialty and licence are ordinarily public professional information, and Lebanese practice registers publish much of it. But the platform is asserting a professional claim on the practitioner's behalf. Requirements: (a) a licence/registration field distinct from free-text `bio`; (b) an admin verification path, which `store_verifications` already models well (`components/store-verifications.tsx:17-28` draws a careful line between self-declared and admin-verified); (c) **`public_visible` must default to opt-in for this sector**, because a clinic can currently publish a locum's photo and name without the locum ever touching the platform — `doctors` has no `user_id`, so the subject of the record has no account and no route to object.

**`beauty` and `fitness` — named individuals, no register.**
Lower legal exposure, higher personal exposure. A junior stylist's face on a public page is a personal-data publication with no professional register behind it. Same `public_visible` requirement, defaulted differently (opt-out is defensible here).

**`education` — the safeguarding case, and the sharpest one.**
`education` is in the `team` bundle (`sectors.ts:305`) and a tutoring centre's roster may include people who work with minors. Publishing photographs of individual tutors is a decision that needs the tutor's consent recorded, and the platform records nothing. **Recommendation: for `education`, default `public_visible = false` and require an explicit per-provider action to publish.**

**`professional` — the reverse.**
Lawyers and accountants *want* to be found by name and credential; the risk is the opposite one, of publishing an unverified claim of qualification. This sector needs the verification path more than the privacy path.

**Cross-cutting, and true today:** `store_providers` (`doctors`) has **no `user_id`**. Every row is a person described by someone else. Rows are publicly readable for any active store (`0026:24-32`). There is no consent record, no takedown route, and no way for the described person to see or correct the record. Whatever else is built, a `consent_recorded_at timestamptz` and a `public_visible boolean` are the minimum, and they are two columns.

---

## 7. The cost of unifying two live tables — stated plainly

The task asked to be explicit about this. **The honest answer is that the expensive unification is the one that should not be done, and the one that should be done is cheap.**

### 7.1 Merging `store_staff` into a team table — DO NOT DO THIS

Not because of row count (1 row), but because `store_staff` is load-bearing for authorization:

- `can_manage_store()` (`0018:30-36`) is defined as *owner OR any `store_staff` row*. Grep across `supabase/migrations/`: **221 occurrences across 81 migration files.** It is the gate on the great majority of RLS policies in the schema.
- `staff_can(store, perm)` (`0024:7-28`) reads `store_staff.permissions` for per-permission policies.
- `0232_staff_permissions_mean_something.sql:5-31` is a migration written specifically to untangle these two functions after finding that `can_manage_store` ignored the permission checkboxes. Its own conclusion (`:26-29`) is worth quoting for the cost estimate: *"Narrowing all sixty at once would lock working merchants out of their own dashboards to fix a problem that lives in a handful of them."*

Touching the shape of `store_staff` means re-validating every one of those policies. The value returned is zero, because a login grant and a public provider card genuinely are different objects — `0254:3-11` already argued this and resolved it correctly by adding a third table rather than overloading the first.

**Cost: very high. Value: negative. Verdict: leave `store_staff` alone.**

### 7.2 Renaming `doctors` → `store_providers` — DO THIS

Measured coupling:

| Surface | Count |
|---|---|
| Migration files referencing `doctors` / `doctor_id` | 10 |
| `doctor_id` occurrences in migrations | 71 |
| `src/` files touching the table or the column | 5 — `merchant/[storeId]/doctors/page.tsx`, `store/[id]/page.tsx`, `components/booking-panel.tsx`, `components/doctor-manager.tsx`, `components/provider-hours.tsx` |
| Dependent tables | 4 — `service_providers`, `bookings`, `provider_availability_rules`, `provider_availability_exceptions` |
| Production rows | 2 |
| Merchant route to rename | 1 — `/merchant/[storeId]/doctors` |

The genuine cost is **not** the rename. It is three things:

1. **RPC parameter names are a public API.** `booked_times(p_doctor_id …)` (`0145:22`), `get_booking_busy(p_doctor_id …)` (`0174:95`), `place_booking(…)` (`0174:228`) are called by name from the browser — `components/booking-panel.tsx:220, 367, 378, 493, 530` all pass `p_doctor_id`. Renaming a Postgres function's named parameter changes the RPC contract; an old client bundle calling `p_doctor_id` against a function expecting `p_provider_id` fails at runtime, not at build. **Recommendation: do not rename RPC parameters. Rename the table and the merchant route only.** The parameter name is invisible to merchants.

2. **The GiST exclusion constraint and partial unique indexes** (`0174:75-76`, `0144:11-12`) are named after `doctor_id` and enforce booking integrity. They survive a table rename untouched — but only if the *column* is not renamed. Another reason to leave `doctor_id` alone.

3. **Plan gating and dictionary keys.** `OS_MODULE_META.doctors` (`sectors.ts:131`) sets `path: "doctors"`, `perm: "bookings"`, `minPlan: "pro"`; `src/lib/plan.ts` and both dictionaries carry `doctors` keys. These are a coordinated rename across four files, not a risk.

**Cost: roughly one focused day, no data migration (2 rows), no RLS re-validation, and zero change to the booking integrity constraints if the columns are left named `doctor_id`. Value: the same engine finally reads as what it already is in six sectors.**

### 7.3 `craft_providers` — leave separate, port the ideas

`craft_providers` is a person who *is* the business; `store_providers` is a person *inside* a business. Different ownership (`user_id not null unique` vs no user at all), different lifecycle, different discovery surface. Merging them would force every salon stylist to hold an account.

Port these four ideas across instead, at near-zero cost each: `headline`, `years_experience`, a `verified` flag with a review queue, and a per-provider work gallery (`craft_works` → the `provider_id` proposed for `store_media` in `10_GALLERY_PORTFOLIO.md` §3).

---

## 8. Recommended order

1. **`alt=""` → provider name** at `store/store-doctors.tsx:34`. One character of substance, real accessibility value.
2. **Fix `sectorHasTeam()`** to read the resolved module set (`sectors.ts:438-440`).
3. **Add `public_visible` + `consent_recorded_at`**, defaulting to opt-in for `education` and `healthcare`. Two columns; the only item in this file with a legal edge.
4. **`providerNoun` in `SectorConfig`** + dictionary keys. Removes "Doctors" from five sectors' dashboards without a migration.
5. **Enrich the public card** — services delivered (`service_providers`, already fetched at `page.tsx:280-283`), availability signal (`provider_availability_rules`, already stored), per-provider CTA. All three are render work over data that exists.
6. **Rename `doctors` → `store_providers`**, table and route only, columns and RPC parameters untouched.
7. **Move the team section up the page** per `05_SECTOR_PROFILE_MATRIX.md` — for `healthcare`, `beauty`, `petCare` and `professional` this is the highest-value single change in this file, and it requires the ordering work from `04` Phase B.

Steps 1–5 need no schema migration beyond two nullable columns. Step 6 is the only one that touches the database structurally, and it touches 2 rows.
