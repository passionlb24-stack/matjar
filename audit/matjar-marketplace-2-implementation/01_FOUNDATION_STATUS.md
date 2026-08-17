# 01 — Foundation Status

## Baseline recorded before any change

| Check | Result |
|---|---|
| Branch at start | `feat/store-approval-loop` (3 commits ahead of `origin/main`, unmerged, preserved) |
| Working tree | clean |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 8 warnings (all pre-existing, none in touched files) |
| `npx vitest run` | 179 passed / 19 files |
| Work branch created | `feat/marketplace-2-foundation`, branched from the above so nothing unmerged is lost |

## Migrations written (NOT applied)

| File | Purpose | Shape |
|---|---|---|
| `0272_a_badge_the_merchant_cannot_award_themselves.sql` | verification outcome guard, reviewer/reason columns, expiry-aware public read | additive + policy replace |
| `0273_verified_purchase_has_to_mean_a_purchase.sql` | recompute `verified` on UPDATE, not only INSERT | trigger replace |
| `0274_hr_is_owner_only_everywhere_not_just_in_the_menu.sql` | 9 HR policies to owner-only; revoke 2 anon-callable functions | policy replace + revoke |
| `0275_two_people_cannot_have_the_same_slot.sql` | provider/resource slot uniqueness, class capacity trigger | 2 partial indexes + trigger |

None drops a column, table, row or constraint. `can_manage_store` itself is untouched (221
occurrences across 81 migrations); only the nine HR policies that misuse it were narrowed.

## Verification method

Every migration was executed **inside a transaction that was then rolled back**, against
production policies and real rows, with `set local role authenticated` and a real user's JWT
claims. Nothing persisted. Before/after was measured in the same transaction, so the "before"
is not a memory of the code but a result.

Conflict checks ran before adding constraints: 0 provider double-bookings, 0 resource
double-bookings, 0 over-capacity classes exist today, so none of the new constraints fails
on creation.

## Not done in Checkpoint A

- Storage path scoping (MP2-005) — needs a code change first, see `00_EXECUTIVE_SUMMARY.md`.
- Repository dead-code sweep — deliberately deferred. Classifying ~250 uninspected components
  as SAFE/ARCHIVE/KEEP without running them is how live code gets deleted; it belongs with the
  pilot, when the sector's real surface is known.
- Transaction state-machine hardening beyond duplicates — `orders` and `bookings` status
  transitions are guarded for the destructive cases (0246 completed-orders-are-final) but not
  as a general machine. Scoped into `04_TRANSACTION_INTEGRITY.md` as remaining.
