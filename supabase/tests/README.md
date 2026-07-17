# supabase/tests

Self-contained SQL regression tests that exercise the checkout RPCs. They need
no external harness: each file is a single `do $$ ... $$` block you paste into
the Supabase SQL editor or run with `supabase db execute`.

## checkout_pricing.test.sql

Regression guard for the checkout **pricing contract** on both order RPCs,
`place_guest_order` and `place_customer_order`.

### Why it exists

Migration `0085` (branch stamping) recreated both RPCs from their pre-flash
bodies and **silently dropped the flash-pricing rule** added in `0058`. Result:
a product inside a live flash window was advertised at `flash_price` but charged
the higher `discount`/base price at checkout — a real money bug, fixed in
`0103`. This test locks that contract in place so the regression can't return.

### What it checks (9 assertions)

| # | RPC | Case | Expected |
|---|-----|------|----------|
| a | guest | flash price wins while `now()` is inside `[flash_start, flash_end)` | `unit_price = 50.00` |
| b | guest | flash window closed → falls back to `discount_price` | `unit_price = 80.00` |
| c | guest | no flash and no discount → base `price` | `unit_price = 100.00` |
| e | guest | `SAVE10` (10%) on a subtotal of 200 | `total = 180.00` |
| a | customer | flash price wins inside the window | `unit_price = 50.00` |
| b | customer | no flash → `discount_price` | `unit_price = 80.00` |
| c | customer | no flash and no discount → base `price` | `unit_price = 100.00` |
| d | customer | variant price **replaces** the base price | `unit_price = 120.00` |
| e | customer | `SAVE10` (10%) on a subtotal of 200 | `total = 180.00` |

Each case builds its own throwaway product (plus a variant / coupon where
needed) in a throwaway store, calls the RPC, and reads back
`order_items.unit_price` / `orders.total`.

### How to run

Supabase SQL editor: paste the file and run. Or:

```bash
supabase db execute --file supabase/tests/checkout_pricing.test.sql
```

### Reading the result — the run "errors" on purpose

The test **always finishes by raising an exception**, because a raised
exception aborts (and therefore rolls back) the transaction. That is how it
guarantees it leaves **no data behind** — the store, users, products, variant,
coupon and orders it created are all rolled back. The exception message tells
you the outcome:

- **PASS** — message contains `CHECKOUT PRICING TEST PASSED`. All 9 checks held.
- **FAIL** — message contains `CHECKOUT PRICING TEST FAILED: [<case>] ...`,
  naming the case and the expected vs. actual value.

So an "error" whose message says `... TEST PASSED ...` is a green run. Any other
message (a `... TEST FAILED ...`, or an unrelated SQL error) is a red run.

### Notes

- Safe to run against any environment (including production): it is fully
  rolled back and writes nothing.
- The customer RPC reads `auth.uid()`; the test fakes a signed-in customer by
  setting the `request.jwt.claims` GUC locally to the throwaway customer id.
- Test products leave `stock` NULL (untracked) so the oversell trigger is a
  no-op, and use `fulfillment = 'pickup'` so no address is required.
