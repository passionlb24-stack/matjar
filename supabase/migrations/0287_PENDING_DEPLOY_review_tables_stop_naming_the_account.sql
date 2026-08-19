-- ============================================================================
-- NOT APPLIED. Do not apply until the app change in this branch is DEPLOYED.
-- ============================================================================
--
-- I applied this to production before the branch was live and took the reviews
-- block off every store page for about a minute. Writing down exactly why, because
-- the SQL below is correct and that is what makes the trap worth recording.
--
-- The deployed build's anonymous storefront read named `reviews.customer_id`.
-- Revoking the column made that query fail with 42501; the caller swallows it with
-- `?? []`; so the reviews section, the rating and the reply rendered as "no reviews"
-- with nothing in any log. Caught only because I diffed the live page for a known
-- reviewer's name before and after. A status-code check would have said 200.
--
-- A grant is a contract with the code that is RUNNING, not with the code in the
-- branch. The app change and this revoke are one change split across two systems
-- that deploy separately, and the safe order is app first, always: the new code
-- does not select the column, so it runs fine under either grant, whereas the new
-- grant breaks the old code instantly.
--
-- To apply, in this order:
--   1. Merge and deploy this branch.
--   2. Load a store page with a review and confirm the reviewer's name renders.
--   3. Apply this file.
--   4. Load it again and confirm the name STILL renders. If it vanished, revert
--      immediately with:  grant select on public.reviews to anon;
--   5. Rename this file to drop the PENDING_DEPLOY marker.
--
-- What it closes: `profiles` is already private to anon, so these ids were never a
-- direct route to a name — but they were a stable key shared across reviews,
-- product_reviews and product_questions, so anyone could join the three, rebuild
-- one person's entire review and question history platform-wide, and attach a name
-- to it from any single review carrying a real one.

-- asker_id is referenced by nothing: not a query, not a filter, not a policy
-- expression needing the caller's columns. Gone for both roles.
revoke select on public.product_questions from anon, authenticated;
grant select (id, product_id, question, answer, answered_at, created_at, asker_name)
  on public.product_questions to anon, authenticated;

-- reviews and product_reviews are deliberately asymmetric. A signed-in customer's
-- "have I already reviewed this?" filters on customer_id, and Postgres requires
-- column SELECT privilege for a WHERE reference even on a row the caller owns
-- (policy expressions are exempt; the caller's own column list is not). So
-- `authenticated` keeps the column and `anon` — which has no ownership question to
-- ask — loses it. Revoking from authenticated too would need a definer wrapper:
-- that trades a working guard for another definer function to audit, and
-- authenticated is not the anonymous scraper this defends against.
--
-- The grants keep store_id / product_id / created_at because the storefront reads
-- filter and order on them, and a missing filter column fails exactly like a
-- missing projection column.
revoke select on public.reviews from anon;
grant select (id, store_id, rating, comment, created_at, customer_name, reply, reply_at)
  on public.reviews to anon;

revoke select on public.product_reviews from anon;
grant select (id, product_id, rating, comment, photos, verified, created_at, customer_name)
  on public.product_reviews to anon;

-- Also worth keeping: a bare
--   revoke select (customer_id) on public.reviews from anon;
-- is a no-op. Column-level revoke only withdraws column-level grants, and the
-- table-level SELECT still covers every column. Revoke the table grant, then grant
-- back the column list — which is what this does.
