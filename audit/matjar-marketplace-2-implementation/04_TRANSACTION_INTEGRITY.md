# 04 — Transaction Integrity

## Duplicate protection: what was actually broken

`bookings` carries two GiST exclusion constraints from the v2 engine (0174). Both are
predicated on `starts_at IS NOT NULL` **and** a specific `allocation_mode`. Measured on live
data: **all 22 bookings have both columns NULL.** The v2 engine shipped; nothing writes to
it. Every real booking arrives through the legacy shape (`requested_date`, `requested_time`)
and matches neither predicate.

So the constraints were not wrong — they were unreachable. Two customers could take the same
appointment, and the only thing standing between them was `booked_times` greying out slots in
the browser, which is a race, not a guarantee.

## What 0275 adds

| Guard | Scope | Why scoped this way |
|---|---|---|
| `bookings_provider_slot_unique` | `(doctor_id, requested_date, requested_time)` where doctor is set and status is live | a named provider is one person |
| `bookings_resource_slot_unique` | `(resource_id, …)` where resource is set | a court/room/chair is one object |
| `bookings_class_capacity` trigger | classes, with `SELECT … FOR UPDATE` on the class row | the lock is the point — without it, two simultaneous bookings both read "one seat left" |

The existing exclusion constraints are **left in place**: the day the v2 path starts writing
`starts_at`, they begin protecting those rows, and the two mechanisms do not conflict.

## What is deliberately NOT guarded

A restaurant taking three tables at 20:00 is a good evening, not a conflict. Those rows carry
no `doctor_id` and no `resource_id` — three such rows exist right now — and the new indexes
correctly ignore them.

**Known gap:** a solo practitioner with no `doctor_id` row cannot be distinguished from a
restaurant table on the legacy shape, because `allocation_mode` is NULL there too. Guessing
would break restaurants. Recorded as MP2-006; the correct fix is to make the booking path
write `allocation_mode`, which is a code change belonging with the pilot.

## Verified, not assumed

Executed in a rolled-back transaction against real rows:

| Scenario | Result |
|---|---|
| Second customer takes the same doctor slot | refused by the database |
| Two restaurant tables at the same 20:00 | both allowed |
| Class of 10, filled to 10, an 11th books | refused (`class_full`) |

## State machines — remaining

Duplicates are closed. General transition validity is not, and is out of Checkpoint A scope.
Current state:

- **Orders**: `guard_order_status_transition` (0246) makes `completed` terminal except for a
  super admin, and refunds are capped at the invoice. The rest of the vocabulary is
  unconstrained — `pending → ready` skipping `preparing` is accepted.
- **Bookings**: no transition guard at all beyond the new capacity/uniqueness rules.
- **Leads**: `status='scheduled'` has no `scheduled_at` and no FK to `bookings`, so a
  scheduled lead points at nothing.
- **Enrollments / memberships / tickets**: bare `text` status columns with **no CHECK
  constraint** — verified against `pg_constraint`. Any string is a valid status.

These are real, none is exploitable for money or privacy, and all belong to the sector whose
pilot needs them.
