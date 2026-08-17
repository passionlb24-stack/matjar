# 02 — Trust and Verification

## The rule applied

A badge is a claim the platform makes to a customer. It may only be displayed if something
other than the beneficiary decided it. Everything below follows from that.

## Before

| Signal | Where it comes from | Could the beneficiary set it? |
|---|---|---|
| `store_verifications.status = 'verified'` | merchant-writable column | **Yes — proven** |
| `product_reviews.verified` ("مشترى موثّق") | trigger on INSERT only | **Yes on UPDATE — proven** |
| `stores.is_verified` | set as a side effect of recording a subscription payment | n/a — but it means "paid" |
| `stores.commercial_reg_verified` | guarded by `stores_guard_featured` | No |

## After (0272, 0273)

`store_verifications` gains `reviewed_by`, `reviewed_at`, `rejection_reason`, and a CHECK
restricting status to `submitted / verified / rejected / expired / suspended`. A
SECURITY INVOKER guard forces every browser-originated INSERT to `submitted` and reverts any
browser attempt to change the verdict. A merchant may still correct their own submission's
title, issuer and number — the fix is narrow on purpose.

The public read now also requires `expires_on` to be absent or in the future: a lapsed
licence stops showing a current badge without anyone noticing.

`product_reviews.verified` is recomputed on UPDATE as well as INSERT, from `order_items`.

## Still true and NOT changed: "verified" means "paid"

`admin-subs-client.tsx:127` sets `is_verified: true` while recording a subscription payment.
The homepage trust strip renders that as **"متاجر موثّقة"**.

This is not a bug to patch quietly — it is a business decision about what the platform tells
customers. Two honest options:

1. **Rename the customer-facing label.** `is_verified` becomes what it is: a paid tier. The
   strip says "متاجر Pro" or similar. Cheapest, and immediately truthful.
2. **Separate the concepts.** Keep `is_verified` for a real review process (now that
   `store_verifications` can carry one), and stop setting it from the payment screen.

Option 2 is the right end state; option 1 is honest today. **Owner decision — not made here.**

## Still true and NOT changed: anyone can review a product without buying it

`reviews` (store reviews) requires `has_store_purchase`. `product_reviews` requires only an
account. That asymmetry is defensible now that the badge distinguishes backed from unbacked
reviews — but it is a policy choice that should be made deliberately rather than inherited.

## Trust states now available

| State | Meaning | Public? |
|---|---|---|
| `submitted` | awaiting human review — appears in `/admin/verifications` | No |
| `verified` | a super admin approved it, and it has not expired | **Yes** |
| `rejected` | declined, with `rejection_reason` recorded | No |
| `expired` | `expires_on` has passed | No |
| `suspended` | withdrawn after the fact | No |
