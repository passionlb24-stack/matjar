-- "مشترى موثّق" can be switched on by the person it is meant to vouch for.
--
-- `set_product_review_verified` computes `verified` honestly — it checks for an
-- order_items row joining this customer to this product. But the trigger is
-- BEFORE **INSERT** only, nothing recomputes it on UPDATE, and `verified` is in
-- the `authenticated` column grant. So a review is written, lands unverified,
-- and one PATCH later carries the badge.
--
-- Executed against the live policies as an ordinary customer, in a rolled-back
-- transaction: the review landed `unverified`, and `set verified = true`
-- succeeded. A badge that the subject of the badge can set is not evidence.
--
-- The fix is one word — the trigger fires on UPDATE too, and the function
-- overwrites whatever was sent with what the orders table actually says.
--
-- A CORRECTION TO THE AUDIT THAT PRODUCED THIS
--
-- The same finding claimed a second hole: that `product_reviews_update_own` has
-- `USING (customer_id = auth.uid())` and no `WITH CHECK`, so authorship could be
-- reassigned to a stranger. **That is wrong, and I tested it rather than
-- repeating it.** Postgres uses the USING expression as the check when WITH
-- CHECK is omitted on an UPDATE policy, so the reassignment is refused with
-- 42501 today. The policy is left exactly as it is; adding a redundant clause
-- would have implied a hole that never existed.
--
-- NOT changed here, deliberately: `product_reviews` still lets any account
-- review any product without buying it, while its sibling `reviews` requires
-- `has_store_purchase`. That asymmetry is a product policy question, not a
-- defect — and it is defensible only now that the badge distinguishes the two.
-- Recorded in 02_TRUST_AND_VERIFICATION.md rather than changed quietly.

drop trigger if exists product_reviews_verified on public.product_reviews;
create trigger product_reviews_verified
  before insert or update on public.product_reviews
  for each row execute function public.set_product_review_verified();

comment on column public.product_reviews.verified is
  'Derived, never accepted from the client: true when this customer has an order containing this product. Recomputed on INSERT and UPDATE by set_product_review_verified().';
