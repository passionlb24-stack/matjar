# 12 — Reviews & Trust

Checkpoint-0 audit. Everything below was read from the repo at
`C:\Users\m-cha\Documents\gh\matjar` and from the live production database
(`wesihatopiznatsyfxer`) using read-only SQL. Row counts were taken during this
audit.

---

## 1. Three review tables — what each one actually is

| | `reviews` | `product_reviews` | `craft_reviews` |
|---|---|---|---|
| Introduced | `0009_reviews.sql` | `0050_product_reviews.sql` | `0239_craft_requests_and_reviews.sql` |
| Subject | `stores.id` | `products.id` | `craft_providers.id` |
| Rows in production | **5** | **1** | **0** |
| Uniqueness | `unique (store_id, customer_id)` | `unique (product_id, customer_id)` | `request_id` is `unique` — one review per job |
| Transaction required? | **Yes** | **No** | **Yes** |
| Rating rollup | `sync_store_rating()` → `stores.rating_avg` / `rating_count` (`0091`) | none — averaged at read time in `src/lib/data/product-reviews.ts` | `sync_craft_rating()` → `craft_providers.rating_avg` / `rating_count` (`0239`) |
| Reviewer name | `customer_name` supplied by the client | `customer_name` supplied by the client | `customer_name` **copied by trigger** from the request, never client-supplied (`0243`) |
| Admin UI | `/admin/reviews` — delete only | **none** | **none** |
| Admin DELETE right | yes (`reviews_delete`) | yes (`product_reviews_delete_own` ORs in `is_super_admin()`) | **no DELETE policy exists at all** |

`craft_reviews` also attaches to `craft_providers`, which is a **different
entity from `stores`** — a craftsman is not a merchant on this platform. It has
0 providers, 0 requests and 0 reviews in production, so the whole third
implementation is currently dead weight.

### Is three implementations justified?

Partly. The three subjects are genuinely different (a shop, a SKU, a tradesman),
and Amazon/Noon do run store-level and product-level ratings separately. What is
**not** justified is that the three were written at three different times with
three different standards of proof, and the later fixes were applied to only one
of them:

- `0090` added `has_store_purchase()` to `reviews`. `0143` then tightened it to
  require a **completed** order or booking. Neither fix was ever applied to
  `product_reviews`.
- `0148` gave super-admins moderation policies on jobs, gigs and wholesale.
  Reviews were not included, so `craft_reviews` still has no delete path.
- `0243` fixed the forgeable reviewer signature on `craft_reviews`. `reviews`
  and `product_reviews` still take `customer_name` straight from the client.

So the honest description is: **one reasonably hardened review table, one that
was never hardened, and one that is well-designed but unused.**

---

## 2. Can a review be tied to a real transaction today?

### `reviews` — yes.

`reviews_insert_own` (live definition, `pg_policies`):

```
((SELECT auth.uid()) = customer_id)
AND user_is_active()
AND rl_recent_reviews((SELECT auth.uid())) < 15
AND has_store_purchase((SELECT auth.uid()), store_id)
```

`has_store_purchase()` as it exists today (`0143_reviews_require_completed.sql`):

```sql
select exists (select 1 from public.orders
               where customer_id = p_uid and store_id = p_store and status = 'completed')
    or exists (select 1 from public.bookings
               where customer_id = p_uid and store_id = p_store and status = 'completed');
```

This is a real gate, enforced in the database, and it survives a client that
talks straight to PostgREST. It is the strongest piece of review trust Matjar
has.

Two residual holes:

- **The link is not stored.** The policy proves a purchase existed *at insert
  time*; the row keeps no `order_id` / `booking_id`. Nothing can later show
  *which* transaction a review refers to, re-check it, or invalidate a review
  when the order it rested on is refunded or reversed.
- **Editing is unbounded.** `reviews_update_own` lets the customer rewrite
  rating and comment forever with no re-check of the purchase and no edit trail
  (`updated_at` moves, the old text is gone).

### `product_reviews` — no.

`product_reviews_insert_own` (live definition):

```
(customer_id = (SELECT auth.uid()))
AND user_is_active()
AND rl_recent_product_reviews((SELECT auth.uid())) < 20
```

There is no purchase requirement. The UI reflects this: the product page passes
`canWrite={!!user}` — `src/app/[lang]/(site)/product/[id]/page.tsx:496`. **Any
signed-in account can rate any product on the platform**, 20 per hour.

### `craft_reviews` — yes, and the cleanest of the three.

`craft_reviews_write` requires a `craft_requests` row with the same customer,
the same provider, and `status = 'completed'`. `request_id` is `unique`, so one
job yields at most one review. The design comment in `0239` states the
principle correctly. It just has no traffic.

---

## 3. The "Verified purchase" badge is forgeable

`product_reviews.verified` is rendered publicly as a green
`Verified purchase` chip — `src/components/product-reviews.tsx` (the
`r.verified &&` branch), string `productReviews.verified` = "Verified purchase"
in `src/i18n/dictionaries/en.json:3763`.

It is set by `set_product_review_verified()`, and the trigger that calls it is:

```
product_reviews_verified | BEFORE | INSERT | EXECUTE FUNCTION set_product_review_verified()
```

(from `information_schema.triggers` on production — **INSERT only**.)

Meanwhile:

- `product_reviews_update_own` is `USING (customer_id = (SELECT auth.uid()))`
  with **no `WITH CHECK`**, so Postgres reuses `USING` as the check — any column
  on your own row is writable.
- `information_schema.column_privileges` shows `authenticated` holds `UPDATE`
  on **`verified`** (and on `product_id`, `customer_id`, `created_at`).

So the sequence *insert a review → `PATCH /rest/v1/product_reviews?id=eq.<mine>
{"verified": true}`* awards the badge. Nothing in the database stops it.

Separately, even the honest insert-time computation is weaker than the store
path: `set_product_review_verified()` (`0050`) matches **any** order containing
the product, of **any** status. An order the merchant rejected still counts as a
purchase. `0143` fixed exactly this on store reviews and was never carried over.

**Verdict: `product_reviews.verified` is a badge that is not backed by a
verification process, and is settable by the person it judges.** It should be
treated as untrustworthy until both the update path and the status filter are
fixed.

---

## 4. `store_verifications.status` is self-awardable — the most serious finding in this document

`0126_store_verifications.sql` says, in its own header:

> only a platform admin can move a row to 'verified' (the earned badge).
> Uploading a document never grants the badge on its own.
> … Status is locked to 'submitted' on the merchant path in the app layer; the
> admin policy is what grants the badge.

The app layer is the only place that is true.

Live policies on `store_verifications` (`pg_policies`):

| policy | cmd | qual |
|---|---|---|
| `store_verifications_public_read` | SELECT | `status = 'verified'` |
| `store_verifications_manage` | **ALL** | `is_store_owner(store_id) OR is_super_admin()` (same `WITH CHECK`) |

`information_schema.triggers` returns **no rows** for `store_verifications` —
there is no `BEFORE INSERT/UPDATE` guard on the table.

`information_schema.column_privileges` shows `authenticated` holds both `INSERT`
and `UPDATE` on the **`status`** column.

Therefore a store owner can send:

```
POST /rest/v1/store_verifications
{"store_id":"<their own>", "title":"Ministry of Health licence", "status":"verified"}
```

and the row immediately satisfies `status = 'verified'`, which is exactly the
predicate the public read policy uses. The badge is granted, no document, no
admin, no `/admin/verifications` queue entry (that page filters
`.eq("status", "submitted")`, so a self-verified row never even appears for
review).

This is the same class of bug the codebase has already fixed twice elsewhere and
documented carefully:

- `0217_platform_column_guards.sql` and `0224_profiles_guard_status_and_badge.sql`
  added `SECURITY INVOKER` guard triggers so a user cannot write `is_active` or
  `freelancer_verified` on their own row. `0224`'s header even explains the
  reasoning — "the trust badge the freelance marketplace is built on … settable
  by the person being judged."
- `store_verifications` was never brought into that sweep.

**Containment today: 0 rows in `store_verifications` and 0 in
`store_verification_docs`.** Nobody has used the feature, so nothing false is on
display right now. That is luck, not design, and it will stop being true the
first time a merchant is told the verifications page exists.

The related `0225` fix (moving `doc_url` into its own table so shoppers cannot
harvest scans of commercial registrations) was correct and is confirmed in
production — `store_verification_docs` has only the manage policy.

---

## 5. `stores.is_verified` — a paid badge described to shoppers as a review

Two separate store-level trust flags exist:

| column | who can write it | how it is earned today |
|---|---|---|
| `stores.is_verified` | admin only (guarded by `guard_store_platform_columns`) | admin toggle in `/admin/stores`, **and automatically set to `true` whenever an admin records a subscription payment** |
| `stores.commercial_reg_verified` | admin only (`guard_store_featured`, `0060`) | admin toggle after eyeballing a registration number |

The automatic grant is at `src/components/admin-subs-client.tsx:127`:

```ts
await supabase.from("stores").update({ plan: tier, is_verified: true }).eq("id", row.id);
```

Recording a manual payment and activating a Pro/Business subscription flips the
verified flag as a side effect. Nothing checks a document.

What the shopper is told:

- `src/components/store-card.tsx:104` renders the badge with
  `dict.featured.verified` = **"Verified"** (`en.json:1318`).
- The homepage `TrustStrip` (`src/components/trust-strip.tsx`) advertises
  **"Verified stores — Reviewed and approved"** (`en.json:1330-1331`).

So a shopper reads "Reviewed and approved" on a badge whose real meaning is
"this merchant paid". That is a badge without a verification process, and it is
worse than an absent badge because it is actively misleading. This is precisely
what the brief warns against.

`commercial_reg_verified` is mechanically honest by comparison — the DB guard in
`0060` prevents self-verification, and editing the registration number resets
the flag, forcing re-review. But there is still **no documented process behind
it**: no required document (the number is a free-text field on
`/merchant/[storeId]/settings`), no recorded verifier beyond the generic
`audit_logs` entry written by `admin-stores-client.tsx`, no expiry, no
re-verification cadence. In production: **1 store has a registration number, 0
are verified.** So the badge has never actually been granted — the process can
still be defined before it has to be undone.

---

## 6. Can a merchant reply to a review?

**No. Nowhere.** Confirmed against `information_schema.columns`: none of
`reviews`, `product_reviews`, `craft_reviews` has a reply, response, merchant
comment, or thread column. No UI exists — `src/components/store-reviews.tsx`
renders name, stars and comment only, and `src/components/product-reviews.tsx`
the same plus photos.

This matters more than it looks. In a market this small, one 1-star review on a
store with 5 total reviews moves `stores.rating_avg` by roughly a full star and
that number sorts the directory. A merchant's only options today are to contact
the customer off-platform, or to ask a super-admin to delete the review. Both
are worse than a public reply.

---

## 7. Is there moderation?

| capability | state |
|---|---|
| Report a review (customer-facing) | **missing** — `content_reports` exists in the DB with `entity_type` accepting `'review'` (`0216_platform_instrumentation.sql`), 0 rows, and **zero references anywhere in `src/`**. Exists but unused. |
| Hide a review without deleting it | **missing** — no status/visibility column on any of the three tables |
| Admin queue for reviews | partial — `/admin/reviews` lists `reviews` only, sorted lowest-rating first, with a single delete button (`src/components/admin-review-delete.tsx`) |
| Admin moderation of `product_reviews` | **missing UI**; RLS delete right exists |
| Admin moderation of `craft_reviews` | **missing entirely** — no DELETE policy on the table, so even a super-admin cannot remove one through the normal client |
| Abuse-rate control | present — `rl_recent_reviews < 15/h`, `rl_recent_product_reviews < 20/h` (`0077`, re-affirmed `0090`) |
| Audit of moderation actions | present for the one action that exists — `src/components/admin-review-delete.tsx` calls `logAdminAction("deleted", "review", reviewId)`. But the log records only *that* a review was deleted, never its text or rating, so the reason a store's public average moved is not recoverable. |

Deletion is the only moderation verb Matjar has. That is a blunt instrument: it
removes the evidence along with the abuse, it cannot be appealed, and because
`sync_store_rating()` fires on DELETE the store's public rating changes with no
record of why.

---

## 8. Proposed verified-review model

### 8.1 One review spine, three subjects

Do not build a fourth table. Converge on a single shape and let the three
existing tables adopt it in order of traffic (`reviews` first, `product_reviews`
second, `craft_reviews` third — it already meets most of the bar).

Every review row should carry:

| field | why |
|---|---|
| `source_kind` + `source_id` | the transaction it rests on (`order` / `booking` / `craft_request`). Not just checked at insert — **stored**, so it can be re-examined, and so a refunded order can demote its review. `craft_reviews.request_id` already does this correctly. |
| `trust_state` (enum, below) | the single value every surface reads. No surface should compute trust itself. |
| `merchant_reply` + `merchant_replied_at` | writable only by `can_manage_store(store_id)`, one reply per review, editable for a bounded window |
| `moderation_state` (enum: `visible` / `flagged` / `hidden` / `removed`) | separated from trust. Trust is about the reviewer; moderation is about the content. |
| `edited_at`, `edit_count` | an edited review must say so |

### 8.2 Explicit trust states

Four states, one meaning each, shown with different words — never the same word
in a different colour:

| state | granted when | shown to shoppers as |
|---|---|---|
| `verified_purchase` | linked to a completed order/booking/request on this platform, still in good standing | **"Verified purchase"** — the only state that gets the tick |
| `platform_customer` | reviewer has a completed transaction with this **store**, but not with this specific **product**; covers the store-review case cleanly | **"Bought from this shop"** |
| `unverified` | account review with no matching transaction (today's entire `product_reviews` path) | **"Unverified"**, plain grey, no tick |
| `disputed` | merchant has flagged it and an admin has not yet ruled | **"Under review"**, review stays visible, excluded from the average |

Rules that make the states mean something:

1. **Only `verified_purchase` and `platform_customer` count toward
   `rating_avg`.** An unverified review may be shown, but it must not move a
   number the directory sorts on. This is enforceable today with a
   `where trust_state in (...)` inside `sync_store_rating()`.
2. **Trust is computed in a `SECURITY DEFINER` trigger on INSERT *and* UPDATE,
   never accepted from the client**, and the column is removed from the
   `authenticated` UPDATE grant. This is the missing half of `0050`.
3. **Editing a review re-runs the trigger and stamps `edited_at`.** A reviewer
   should not be able to write a positive review, collect whatever they were
   promised, then rewrite it with the verified tick intact and no marker.
4. **The transaction link is stored**, so a refund can demote
   `verified_purchase` → `platform_customer` rather than silently leaving a
   verified badge on a reversed sale.

### 8.3 Merchant reply, done safely

- One reply per review, by `can_manage_store(store_id)` only.
- Editable for 24 hours, then frozen; `merchant_replied_at` shown.
- Replies are content and go through the same `moderation_state`.
- A reply never changes the star rating and never hides the review.

The reason to build this before anything else in this document: it is the only
change that gives a merchant a *proportionate* response to a bad review. Every
other option they have today is disproportionate (delete it, or leave the
platform).

### 8.4 Reporting and hiding

- Wire the existing `content_reports` table (`entity_type = 'review'`) to a
  report button on every review. The table, its status enum
  (`pending/reviewing/actioned/dismissed`), its resolver columns and its
  indexes already exist and are unused — this is plumbing, not new schema.
- Add `moderation_state` so an admin can **hide** rather than delete. Deletion
  should be reserved for illegal content and should always write an
  `audit_logs` row.
- Give `craft_reviews` a super-admin DELETE policy in the same change; today
  there is none.

---

## 9. Badges Matjar is currently at risk with — the blunt list

| badge | backed by a real process? | verdict |
|---|---|---|
| `product_reviews.verified` → "Verified purchase" | **No.** Forgeable by UPDATE; and even honestly set it accepts orders of any status. | **Stop rendering it** until the update path is closed and the check requires `status='completed'`. |
| `store_verifications.status = 'verified'` → public certificate badge | **No.** Any store owner can insert or update the row to `verified` directly. | **Close the hole before the feature is promoted to merchants.** 0 rows today, so the fix is free. Add a guard trigger of the same shape as `0217`/`0224`, and drop `status` from the `authenticated` column grants. |
| `stores.is_verified` → "Verified" / "Reviewed and approved" | **No.** Auto-granted on subscription activation (`admin-subs-client.tsx:127`). | Either rename it honestly (it is a **plan** badge, and `pro-badge.tsx` already exists for that) or stop setting it from the subscription path and define what "verified" requires. Do not keep both the auto-grant and the words "Reviewed and approved". |
| `stores.commercial_reg_verified` → "Registered business" | Mechanically safe (DB-guarded, resets on number change), **process undefined** — no required document, no expiry, no re-check. | Write the process down before granting the first one. 0 granted today. |
| `profiles.freelancer_verified` | Guarded correctly since `0224`. | Out of scope here; noted as the pattern the other badges should follow. |

---

## 10. Ordered recommendations

1. **Guard `store_verifications.status`.** Guard trigger + revoke the column
   grant. Zero rows means zero migration risk. (Also the only finding here that
   is exploitable from a browser today.)
2. **Stop `product_reviews.verified` from being client-writable**, and make the
   trigger fire on UPDATE as well as INSERT, requiring `orders.status =
   'completed'`. Until then, do not render the chip.
3. **Decide what `stores.is_verified` means**, and remove the automatic grant in
   `admin-subs-client.tsx:127` if it is meant to signal anything other than
   payment. Fix the homepage copy either way.
4. **Add merchant reply** to `reviews`. Highest merchant-visible value per line
   of code in this document.
5. **Store the transaction link** on `reviews` (`order_id` / `booking_id`), and
   add `trust_state`; make `sync_store_rating()` count only trusted states.
6. **Give `product_reviews` a purchase requirement** matching `has_store_purchase`.
7. **Wire `content_reports` to reviews** and add `moderation_state` so hiding
   becomes possible; add a super-admin DELETE policy to `craft_reviews`.
8. **Decide the fate of `craft_reviews`.** 0 providers, 0 requests, 0 reviews.
   Either commit to the crafts vertical or fold craftsmen into `stores` with the
   `contractors` sector, which already exists in `sectors.ts` with a `requests`
   + `portfolio` + `verifications` bundle. Maintaining two parallel service-pro
   models with three review tables between them is not justified by the traffic.

---

## Could not verify

- I did not execute the forgery paths against production. Both findings (§3, §4)
  rest on the live policy definitions, the live column grants and the live
  trigger list, read via `pg_policies`, `information_schema.column_privileges`
  and `information_schema.triggers`. They should be confirmed in a
  `begin; … rollback;` transaction with `set local role authenticated` before
  the fix ships — that is the house pattern, and I stayed read-only here.
- No merchant or shopper research informs this document. The trust states in
  §8.2 are derived from what the schema can prove, not from what Lebanese
  shoppers say they believe. That research does not exist yet and is not
  invented here.
- `craft_providers`, `craft_requests` and `craft_reviews` are all empty, so the
  crafts review path has never been exercised against real behaviour. Its design
  reads well; it is untested.
