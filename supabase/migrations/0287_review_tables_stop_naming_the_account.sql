-- Applied 2026-08-21, after the branch was merged and deployed.
--
-- Held back for a day on purpose. An earlier attempt applied this while
-- production still ran the build whose anonymous storefront read named
-- customer_id: the query started failing with 42501, the caller swallows it
-- with `?? []`, and the reviews block silently emptied on every store page.
-- Caught only because I diffed the live page for a known reviewer's name — a
-- status check said 200 throughout.
--
-- The ordering rule that came out of it: a grant is a contract with the code
-- that is RUNNING, not the code in the branch. App first, always — the new code
-- runs fine under either grant, whereas the new grant breaks the old code
-- instantly.
--
-- Before applying this time, two markers from the previous two commits were
-- confirmed present in the live HTML, so the deploy was known to have landed
-- rather than assumed. After applying: both store pages 200, the reviewer name
-- still renders, and customer_id appears nowhere in the response.
--
-- What it closes: profiles is private to anon, so these ids were never a direct
-- route to a name — but they were a stable key shared across reviews,
-- product_reviews and product_questions, so anyone could join the three,
-- rebuild one person's entire review and question history platform-wide, and
-- attach a name to it from any single review carrying a real one.
--
-- reviews and product_reviews stay readable by authenticated: the signed-in
-- "have I already reviewed this?" check filters on customer_id, and Postgres
-- requires column privilege for a WHERE reference even on a row the caller
-- owns. Policy expressions are exempt; the caller's own column list is not.
--
-- Worth keeping, because it cost time to discover: a bare
--   revoke select (customer_id) on public.reviews from anon;
-- is a no-op. Column-level revoke only withdraws column-level grants, and the
-- table-level SELECT still covers every column. Revoke the table grant, then
-- grant back the column list — which is what this does.

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
