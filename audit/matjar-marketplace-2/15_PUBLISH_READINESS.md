# 15 — Publish Readiness

---

## 1. What exists: a 4-value enum, used as 2

`supabase/migrations/0003_stores_and_business_types.sql:3`:

```sql
create type store_status as enum ('pending', 'active', 'suspended', 'rejected');
```

`stores.status` is `not null default 'pending'` (`0003:38`), indexed
(`stores_status_idx`, `0003:47`), and the public visibility rule is a single
predicate in the select policy (`0003:89`):

```sql
using (status = 'active' and deleted_at is null)
```

Everything downstream reads that one predicate. `stores.status` is the only
publish concept in the system.

### How the four values are actually used in production

Read during this audit, `stores` where `deleted_at is null`:

| status | count |
|---|---|
| `active` | **13** |
| `suspended` | **20** |
| `pending` | **0** |
| `rejected` | **0** |

Two of the four values have never been used. Not "rarely" — never. And `pending`
being empty means every store that has ever been created has already been ruled
on.

This is the single most important fact in this document, and it says something
the brief does not assume: **the problem is not that the enum is too small. The
problem is that `suspended` is doing three jobs at once.** 20 of 33 stores sit
in a bucket that could mean "abandoned signup", "not finished yet", "admin
turned it off" or "merchant asked us to pause it", and the schema records no
reason, no actor and no history to tell them apart. `stores` has no
`status_reason`, no `status_changed_at`, no status-history table — confirmed
against `information_schema.columns`.

Adding four more enum values on top of that will produce a five-way ambiguity
instead of a three-way one.

---

## 2. The proposed model versus the real enum

The brief proposes `DRAFT → INCOMPLETE → READY_FOR_REVIEW → PUBLISHED →
SUSPENDED`. Mapped honestly onto what exists:

| proposed | maps to | is it a *state* or a *derived fact*? |
|---|---|---|
| `DRAFT` | `pending` | **state** — a real one, and today's `pending` already means it |
| `INCOMPLETE` | — | **derived.** "Incomplete" is `completeness_score < publish_threshold`. It is not a decision anyone makes; it is a computed property of the row. Storing it duplicates the score and guarantees the two drift. |
| `READY_FOR_REVIEW` | — | **state.** Genuinely missing, and genuinely useful: it is the merchant saying "I'm done, look at it." Today the merchant has no way to say that, and the admin has no way to tell a store that is waiting from one that is still being built. |
| `PUBLISHED` | `active` | **state** |
| `SUSPENDED` | `suspended` | **state** |
| — | `rejected` | **state**, exists, never used |

So the honest gap is **one new value (`ready_for_review`)**, plus a reason
column, plus a status-history record — not a five-state rewrite. `INCOMPLETE`
should be a badge computed from `completeness_score`, rendered in the merchant
UI and the admin queue, and never written to `status`.

### Recommended target

```
draft ──(merchant submits)──▶ ready_for_review ──(admin)──▶ active
  ▲                                  │                        │
  └────────(admin returns)───────────┘                        │
                                                              ▼
                                  rejected ◀──(admin)   suspended
```

- `pending` is renamed to `draft` **or left as `pending`** — see §5, the rename
  is optional and the migration cost is not zero.
- `ready_for_review` is the one added value.
- "Incomplete" is a derived label: `completeness_score < sector threshold`.
- Every transition writes a reason and an actor.

---

## 3. Minimum publish requirements per sector

The rule that makes this honest: **a store may not be submitted for review
unless it can complete the transaction its sector promises.** Not "unless it
looks nice" — unless a customer who arrives can actually get what the listing
implies they can get.

Common floor, all 17 sectors (from `PROFILE_COMPLETENESS_MATRIX.csv`,
`required_for_publish=yes`):

- store name, business type, region + area
- description
- logo
- at least one working contact — WhatsApp (and phone where the sector's enquiry
  channel is a call)

Sector core, on top of the floor:

| Sector | Cannot be submitted without | Also required |
|---|---|---|
| food | ≥1 menu item | hours; delivery **or** pickup enabled |
| retail | ≥1 product | hours; map pin |
| services | ≥1 service | phone; service area *(new field)* |
| healthcare | ≥1 service **and** ≥1 practitioner | hours; map pin; phone |
| realEstate | ≥1 listing **with photos** | phone |
| automotive | ≥1 listing **with photos** | hours; map pin |
| beauty | ≥1 service; `booking_slot_minutes` set | hours; map pin |
| fitness | ≥1 membership plan **or** ≥1 class | hours; map pin |
| sportsCourts | ≥1 bookable resource; `booking_slot_minutes` set | hours; map pin |
| education | ≥1 course | map pin; phone |
| events | ≥1 ticket type | cover image; map pin |
| hospitality | ≥1 accommodation unit **with photos** | cover image; map pin; phone |
| pharmacy | ≥1 product | **hours** (the whole question); map pin; licence on file |
| petCare | ≥1 service | hours; map pin; phone |
| professional | ≥1 service | phone |
| contractors | ≥1 portfolio item **and** ≥1 service | WhatsApp; phone; service area *(new field)* |
| farm | ≥1 product | delivery **or** pickup enabled |

Two notes on this table:

**Licences are required-on-file, not required-verified.** For `pharmacy`,
`healthcare`, `professional`, `education` and `contractors` the sensible rule is
that a document must be *submitted* before publish, and the *verified badge* is
granted separately by an admin. That distinction is exactly what `0126` intended
and exactly what is currently broken — a merchant can write
`status = 'verified'` on their own `store_verifications` row (see
`12_REVIEWS_TRUST.md` §4). **Do not gate publish on that column until the guard
trigger exists**, or you will have built a gate whose key is printable by the
person outside the door.

**Two sectors already have a working precedent for the "core entity" check.**
`sectorPrimarySetup()` (`src/lib/sectors.ts:425-433`) already counts
`accommodation_units` for hospitality and `event_ticket_types` for events, and
the OS home already queries it (`merchant/[storeId]/page.tsx:594-604`). The
publish gate is the same query generalised to 17 sectors, not new machinery.

---

## 4. Directory-only mode

### Why it is needed, in this codebase specifically

Several sectors have a full public identity and no working transaction engine:

| sector | transaction engine | live rows |
|---|---|---|
| `sportsCourts` | `store_resources` + timeslot bookings | 2 resources |
| `fitness` | `store_membership_plans` / `store_classes` | 2 plans, 1 class, **0 memberships** |
| `education` | `store_courses` | 2 courses |
| `events` | `event_ticket_types` | **0** |
| `contractors` / `services` | `store_portfolio` + requests | **0 portfolio**, 2 service requests |
| `realEstate` / `automotive` | `leads` | 3 leads |

`sectors.ts` is already honest about one of these. The `automotive` block
carries this comment (lines 254-257):

> Directory-only (no cart) + single inquiry channel = Leads (car inquiries are
> viewing/test-drive/offer). No "orders" (always empty) and no separate
> "requests" inbox.

So the concept exists in the codebase's own reasoning. What is missing is a
**state**, so the platform can say it out loud to shoppers instead of shipping a
booking button that goes nowhere.

### The specification

`directory` is not a fifth status value. It is a **publish mode** — an
orthogonal column, because a store can be `active` *and* directory-only, and
must be able to graduate without changing its status:

```
stores.publish_mode  enum ('transactional', 'directory')  not null default 'transactional'
```

**What directory-only means, precisely:**

| | transactional | directory |
|---|---|---|
| store page is public | yes | yes |
| appears in search / explore / category | yes | yes |
| profile, photos, hours, map, description | yes | yes |
| reviews readable | yes | yes |
| primary CTA | Order / Book / Buy tickets | **Call · WhatsApp · Directions** |
| cart, checkout, booking form | rendered | **not rendered at all** |
| leaving a review | requires a completed order/booking | **impossible** — no transaction can exist, so `has_store_purchase()` correctly returns false |
| merchant dashboard | full sector module set | daily group collapses to `leads` + `tasks`; money group hidden |
| customer-facing label | none | a plain line: "This business takes enquiries by phone and WhatsApp" |

**Rules that keep it honest:**

1. **Never render a disabled control.** A greyed-out "Book now" is worse than no
   button — it reads as a broken site rather than a deliberate choice. Directory
   mode removes the control, it does not disable it.
2. **Publish requirements drop to the common floor plus contact.** The whole
   point is to let a business be *findable* before its engine is ready. Requiring
   a bookable resource to publish a court that will be phone-booked defeats it.
3. **`publish_mode` is set by the platform, not the merchant** — at least at
   first. It should default from the sector (an admin-configurable per-sector
   default, see `19_SUPER_ADMIN_SECTOR_ENGINE.md`), with a per-store override
   available to admins. A merchant choosing "directory" to dodge a checklist is
   not the behaviour to design for.
4. **Graduation is a one-way nudge, not a cliff.** When a directory store adds
   its first bookable resource / ticket type / product, the OS home should offer
   "you can start taking bookings now" as a suggestion — the suggestions engine
   at `merchant/[storeId]/page.tsx:612-650` is the right place and already has
   this shape.
5. **Ranking must not punish it.** A directory store with a complete profile is
   a genuinely useful search result in a market of 13 live stores. It should
   sort on relevance and completeness like anything else.

**Migration cost of `publish_mode`: low.** New nullable-with-default column on
`stores`, one guard trigger to keep it out of merchant hands (same shape as
`guard_store_platform_columns`, `0217`), and a branch in the store-page CTA. No
enum surgery, no policy rewrite — `stores_select` still keys on `status`.

---

## 5. Honest assessment: the cost of changing a live enum

`store_status` is a Postgres enum. The three operations differ enormously in
cost.

### 5.1 Adding `ready_for_review` — genuinely cheap, with one trap

```sql
alter type public.store_status add value 'ready_for_review' after 'pending';
```

- Cost: near zero. No table rewrite, no lock beyond a brief catalog lock.
- **Trap:** before PostgreSQL 12 this could not run inside a transaction block
  at all; from 12 onward it can, but **the new value cannot be used in the same
  transaction that adds it.** This directly conflicts with the house
  verification pattern recorded in this project's conventions —
  `begin; … rollback;` with `set local role authenticated`. The `ADD VALUE`
  must ship in its own migration, and only a *later* migration or session may
  reference the literal.
- Consequence: the enum change and the code that uses it are **two migrations**,
  not one. Plan for that.

### 5.2 Renaming `pending` → `draft` — cheap in SQL, expensive in surface area

```sql
alter type public.store_status rename value 'pending' to 'draft';
```

is instant and rewrites nothing. The cost is entirely in the callers:

| caller | file |
|---|---|
| status pill styling + labels | `src/app/[lang]/(dashboard)/merchant/page.tsx:13`, `:18-23` |
| dictionary keys `merchant.status.*` | `src/i18n/dictionaries/{ar,en}.json` |
| admin filter + labels | `src/components/admin-stores-client.tsx` (`statusVariant`, `t.statusLabels`, the `s.status === "pending"` approve branch) |
| `on_store_status_change()` | `0271` — its `case` has an explicit "back to pending is a re-review" branch |
| any TS union typed `"pending" \| "active" \| "suspended" \| "rejected"` | at least `merchant/page.tsx:13`; regenerate via `generate_typescript_types` and let `tsc --noEmit` find the rest |

**Recommendation: do not rename.** `pending` is a perfectly good word, the
merchant-facing string is a dictionary value that can say "Draft" without the
enum changing, and a rename buys nothing but risk. Spend the budget on
`ready_for_review` and the reason column instead.

### 5.3 Removing a value (e.g. retiring `rejected`) — expensive, and unnecessary

Postgres has no `DROP VALUE`. Removing one means: create a new type, add a new
column, backfill, swap the default, drop and recreate every policy and index
that references the column, drop the old column, rename, drop the old type. On a
33-row table that is minutes of work and hours of care, and every RLS policy
touching `stores.status` — including `stores_select`, the policy the entire
public site depends on — has to be dropped and recreated correctly.

`rejected` has 0 rows but is the right word for a real outcome and is already
wired into `on_store_status_change()` and `push_on_notification()` (`0271`).
**Leave it.** An unused enum value costs nothing; a botched type swap on the
table that gates all public visibility costs everything.

### 5.4 What actually needs a migration

| change | cost | note |
|---|---|---|
| `ADD VALUE 'ready_for_review'` | trivial | must be its own migration |
| `stores.status_reason text` | trivial | additive |
| `stores.status_changed_at timestamptz` | trivial | additive; set in `on_store_status_change()` which already fires |
| `store_status_history` table | small | `0092_order_status_history.sql` is the pattern to copy — it already exists for orders |
| `stores.publish_mode` enum + default | small | additive, plus a guard trigger |
| `stores.completeness_score smallint` | small | additive, plus a recompute trigger (see `14_PROFILE_COMPLETENESS.md` §3.4) |
| relax the status guard to allow **one** merchant transition | **the real design problem** | see §5.5 |

### 5.5 `stores.status` is currently guarded shut — which is the hard part

I read the live function body of `guard_store_platform_columns()` from
`pg_proc`:

```plpgsql
if current_user not in ('authenticated', 'anon') then return new; end if;
if public.is_super_admin() then return new; end if;

new.plan          := old.plan;
new.status        := old.status;      -- ← merchants cannot move status at all
new.trial_ends_at := old.trial_ends_at;
new.rating_avg    := old.rating_avg;
new.rating_count  := old.rating_count;
new.owner_id      := old.owner_id;
new.invoice_next_no := old.invoice_next_no;
```

This is correct today and is the pattern `store_verifications` should have
copied (`12_REVIEWS_TRUST.md` §4 — that table has **no** guard trigger at all,
and its `status` is self-settable).

But it means "submit for review" cannot simply be a merchant `UPDATE`. The
guard silently reverts the write, so the merchant would press the button, get no
error, and see nothing change — the worst possible failure mode.

Two ways to do it properly:

**(a) Narrow the guard to allow exactly one transition** — the shape the guard
already supports, since `old` and `new` are both in scope:

```plpgsql
-- allow only pending → ready_for_review, by anyone who may manage the store
if not (old.status = 'pending' and new.status = 'ready_for_review'
        and public.can_manage_store(new.id)) then
  new.status := old.status;
end if;
```

**(b) A `SECURITY DEFINER` RPC** — `submit_store_for_review(p_store_id)` — which
checks `can_manage_store()`, checks the per-sector minimums from §3 **server
side**, and only then writes the status. The guard trigger stays fully shut,
because `current_user` inside a `SECURITY DEFINER` function is the function's
owner and the `current_user not in ('authenticated','anon')` early-return lets
it through untouched.

**(b) is the right choice**, for two reasons. It keeps the guard absolute — one
fewer conditional branch protecting the most security-relevant column on the
table — and it is the only way to enforce the §3 publish minimums where the
merchant cannot bypass them. A client-side check plus a permissive guard means a
merchant with a REST client can submit an empty store. `0198`, `0229` and `0232`
all establish this pattern in the codebase already: the rule lives in the
database function, not in the page.

---

## 6. Recommended sequence

1. **Add `status_reason` + `status_changed_at`** and start recording why. This
   alone resolves the 20-store `suspended` ambiguity going forward, and costs
   two additive columns.
2. **Add `store_status_history`**, copying `0092_order_status_history.sql`.
3. **Add `ready_for_review`** in its own migration (nothing else in that
   migration — see §5.1).
4. **Build `submit_store_for_review()` as a `SECURITY DEFINER` RPC** that
   enforces the §3 per-sector minimums server-side, leaving
   `guard_store_platform_columns()` fully shut (§5.5). Then the merchant button
   and the admin queue split.
5. **Add `publish_mode`** and turn on directory mode for the sectors whose
   engines are empty — `events`, `sportsCourts`, `contractors`, plus
   `automotive` which the code already describes as directory-only.
6. **Do not rename `pending`. Do not remove `rejected`.**

---

## Could not verify

- Why 20 stores are `suspended`. The schema records no reason and no history, so
  this cannot be recovered from the database — it has to be asked of whoever
  suspended them. That irrecoverability is itself the argument for §6.2.
- No data on how long approval takes. `audit_logs` records admin actions and
  `stores` records `created_at`, so a median time-to-approval could be computed;
  I did not compute it, and no figure is invented here.
