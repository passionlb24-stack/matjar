# Checkpoint A — Foundation Stability

**Status: complete. Nothing deployed.** Four migrations written and verified; none applied
to production, per the instruction not to deploy without approval.

## What was actually wrong

Four defects, each verified by executing it against live policies in a rolled-back
transaction rather than by reading code and inferring.

| # | Defect | Proven by | State |
|---|---|---|---|
| A-1 | A merchant can award themselves a **verification badge**. The public storefront shows it; the admin queue never does. | Inserted `status='verified'` as an ordinary merchant. Public read returned it; review queue returned 0. | **Fixed** — 0272 |
| A-2 | **"مشترى موثّق"** can be switched on by the reviewer it vouches for. | Wrote a review (landed `unverified`), then `set verified = true` — succeeded. | **Fixed** — 0273 |
| A-3 | **Any staff member reads every salary**, national ID, GPS punch history, and every live enrolment code. | Hired a cashier with `products` permission only; read 3 salary rows, 8 enrolment codes, 5 GPS punches across a store they do not own. | **Fixed** — 0274 |
| A-4 | **Two customers can take the same appointment slot.** Both exclusion constraints are predicated on columns that are NULL on all 22 live bookings. | Booked one doctor slot twice — both succeeded. | **Fixed** — 0275 |

A-3 is mine. I built the WebAuthn clock-in and argued that enrolment codes must be read out
face to face because they stand in for a password. That was true about the door and false
about the database: any staff member could read a live code and enrol their own phone
against a colleague's name — the exact buddy-punching the design exists to prevent.

## One audit claim I refused to carry forward

The audit that fed this checkpoint also reported that `product_reviews_update_own` lacks a
`WITH CHECK`, allowing a review's authorship to be reassigned to a stranger. **I tested it
instead of repeating it. It is false** — Postgres uses the `USING` expression as the check
when `WITH CHECK` is omitted on an UPDATE policy, and the reassignment is refused with
42501. 0273 was rewritten to fix only the real half, because a migration that closes a hole
that never existed teaches the next reader something untrue.

## What was deliberately not fixed

**Storage upload scoping.** `store_assets_auth_insert` is `with check (bucket_id =
'store-assets')` and nothing else, so any signed-in user can write anywhere in the public
bucket. Real. Not fixed here, because the obvious fix — require the first path segment to be
a store you own, as `digital-goods` does — would break uploads: the paths are not uniform
(`storeId` in 8 places, but also `wholesale`, `gigs`, `reviews`, `listings`,
`crafts/${userId}`, `verifications/${storeId}`). Fixing it properly means normalising the
path convention across ~15 call sites first. Tracked as MP2-005. Scope: `authenticated`
only — an anonymous visitor cannot upload.

## Demo and fabricated data

Searched and found **almost nothing**, which is worth stating plainly because the brief
assumed otherwise: no hardcoded statistics, no testimonials, no placeholder copy, no
test-named stores, and no store carrying a rating with zero reviews.

One finding: of 5 store reviews, 4 are backed by a booking and 1 by an order — but the
oldest (1 July) has **neither**, predating the `has_store_purchase` requirement. It is
ungrounded, not fabricated. Deleting a real customer's review to tidy a metric would be the
worse error; it is recorded in `03_DEMO_DATA_AUDIT.md`.

## Baseline and regression

Recorded before any change: typecheck clean, lint 0 errors / 8 pre-existing warnings, 179
tests passing, working tree clean. All four migrations are SQL-only — no application code
was touched in Checkpoint A, so the gates are unchanged by construction and were re-run to
confirm.

## What this does not yet do

Nothing here makes Matjar a better marketplace. It makes its trust signals true and its
bookings safe, which is the precondition for everything in Checkpoints B–F. The platform
still has 13 active stores in one region, 12 of 17 sectors with no merchant, zero recorded
searches, and analytics that never loaded (CSP blocks the tag). Those are Checkpoint B and
the pilot.

## Awaiting approval

The four migrations are ready and verified but **not applied**. They are additive: three
policy/trigger changes and two partial indexes. None drops a column, table or row.
