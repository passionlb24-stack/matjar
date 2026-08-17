# 03 — Demo and Fabricated Data Audit

The brief expected to find fake ratings, fabricated merchant counts, placeholder
testimonials and hardcoded statistics. **Almost none of it exists.** Stating that plainly is
the finding.

## What was searched

- UI source (`src/components`, `src/app`) for hardcoded counts, `NNN+` marketing figures,
  literal ratings, testimonial blocks, and lorem/placeholder text in both scripts.
- Production data for test-named stores, ratings without reviews, zero-priced products, and
  reviews with no transaction behind them.

## Results

| Check | Result | Classification |
|---|---|---|
| Hardcoded stats / testimonials / lorem in UI | **none found** | — |
| Stores named test/demo/تجريب/sample | **none** | — |
| Stores showing a rating with 0 reviews | **0** | — |
| Products priced 0 or null | 1 | production data — a real merchant's row, likely a "call for price" item the model cannot express (see offering-model gap) |
| Store reviews with no order behind them | 4 of 5 | **backed by bookings** — not fabricated |
| Store reviews with neither order nor booking | **1** (written 2026-07-01) | production data, ungrounded |

## The one ungrounded review

It predates the `has_store_purchase` requirement on `reviews_insert_own`. It is a real row
written by a real account; it simply has no transaction behind it because the rule did not
exist yet.

**Not deleted.** Removing a customer's genuine review to make a provenance metric look clean
is a worse act than leaving one historical row unbacked. If provenance is to be displayed
per review, the honest treatment is to show it as unbacked rather than to erase it.

## Ratings integrity

`sync_store_rating` is SECURITY DEFINER and is the only writer of `rating_avg`/`rating_count`;
`stores_guard_featured` reverts browser writes to the guarded columns. No store carries a
rating it did not earn.
