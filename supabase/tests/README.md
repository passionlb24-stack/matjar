# supabase/tests

Self-contained SQL regression tests. They need no external harness: each file is
a single dollar-quoted `do` block you paste into the Supabase SQL editor or run
with `supabase db execute`.

Every file here **always ends by raising an exception**, on purpose. A raised
exception aborts — and therefore rolls back — the transaction, which is how a
test that writes its own fixtures leaves nothing behind. So an "error" whose
message says `... PASSED ...` is a **green** run. Read the message, not the
status.

| File | Guards |
|---|---|
| `checkout_pricing.test.sql` | the checkout pricing contract on both order RPCs |
| `rls_policy_matrix.test.sql` | staff permissions, cross-store isolation, anonymous reach, and the column grants that hide reviewer identity |

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

## rls_policy_matrix.test.sql

Regression guard for **who can read what**. Written against the leak fixed in
`0291`: five Business OS tables were gated on `can_manage_store` (true for *any*
staff row) instead of `staff_can(store_id, perm)`, so a staff member hired to
manage products could read the name and phone of every customer who abandoned a
cart.

### The rule the file exists to enforce

**Seed, then read as a role.** RLS filters rows silently — it does not raise. On
an empty table "blocked" and "nothing there" are the same answer, and that is
what nearly buried `0291`. So every "expected 0" here is paired with an
"expected ≥1" from an actor who *should* see that same row. A suite that only
checks the negative passes just as happily when the feature has been deleted.

### What it asserts

- **Staff permissions.** Twelve staff members — ten holding exactly one of the
  ten `PERM_KEYS` from `src/components/staff-manager.tsx`, one holding all ten,
  one holding none — read every governed table. `0291`'s five
  (`checkout_intents`, `store_invoices`, `payments`, `subscriptions`,
  `supplier_transactions`) are in the matrix by name.
- **Cross-store isolation.** Every fixture exists twice, in store A and store B.
  Every store-A principal must see zero of B; store B's owner reading his own
  row is the positive control proving the B row was there.
- **Anonymous reach.** `anon` against every merchant table (zero) *and* against
  the public storefront tables (non-zero — a suite that only proved anon sees
  nothing would go green on a bricked storefront).
- **The transitive cases**, `pos_sale_items` and `lead_activities`. Both still
  gate on `can_manage_store`, but through a subquery on an RLS-filtered parent,
  so they are protected transitively. Asserted deliberately so that if someone
  "simplifies" the parent policy the child's protection cannot vanish silently.
- **Column grants** on `reviews`, `product_reviews`, `product_questions` and
  `craft_reviews`. Those rows are `select using (true)` by design; hiding
  `customer_id` / `asker_id` is a GRANT question, not a policy question.

### Reading the result

- `RLS MATRIX PASSED` — green. Current baseline: **729 passed, 24 pending**.
- `RLS MATRIX FAILED` — red. Each line names the actor, the table, the store
  side, and what it saw.
- `RLS MATRIX STALE` — the suite is right about the database and wrong about
  itself: a check marked pending started passing, so the migration landed and
  the marker should be deleted. One-line edit.

### The 24 pending checks are real findings, not noise

- **20** — `accommodation_units` and `event_ticket_types`. `units_public_read`
  and `ticket_types_public_read` are `(active = true) or can_manage_store(...)`,
  so a staff member with **every permission off** reads the store's inactive
  units and inactive ticket types. Same predicate `0291` replaced; two siblings
  it did not reach. Needs a migration.
- **4** — `0287_PENDING_DEPLOY`, which must not be applied until the app change
  ships (`0287` records the minute-long outage caused by applying it early).

### Adding a table

One line in `v_cases` plus its fixture row. The expected value is *derived* from
the actor, never written out per table — a hand-written expectation matrix is
where the next hole hides.

### How to run

```bash
supabase db execute --file supabase/tests/rls_policy_matrix.test.sql
```

Safe against any environment including production: everything is inside
`begin; … rollback;` **and** the block always raises, so nothing it writes can
survive even if the trailing `rollback` never runs.
