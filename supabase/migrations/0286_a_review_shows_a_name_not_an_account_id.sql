-- MP-010. reviews, product_reviews, craft_reviews and product_questions are all
-- `select using (true)` and all expose the reviewer's account id, so an
-- anonymous client can join across them and rebuild a person's review and
-- question history platform-wide.
--
-- THE EXPOSURE IS REAL AND WAS MEASURED. As `anon`, in a rolled-back
-- transaction against production:
--     reviews            5 rows readable, 4 distinct customer_id
--     product_reviews    1 row readable with customer_id
--     product_questions  0 rows today, but the column is readable
--     craft_reviews      0 rows today, but the column is readable
--     profiles           0 rows -- correctly private, so a bare uuid does not
--                        resolve to a name through that table
-- The only anon route from a uuid to a person is public_lister_profile(uuid),
-- and that returns nothing unless the user has an active gig. So today the
-- leak is a stable cross-table correlator, not a name lookup. It still should
-- not be there: customer_name is already on every row, which is exactly the
-- "display name, no stable identifier" the issue asks for.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION FIXES, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
-- FIXED: craft_reviews.customer_id. Every read path was enumerated across the
-- whole tree (there is no supabase/functions and no scripts/, so src/ is the
-- entire surface). craft_reviews is never selected directly; it is only ever
-- reached through two PostgREST embeds, and neither asks for customer_id:
--     src/app/[lang]/(site)/crafts/p/[id]/page.tsx:50
--         craft_reviews(id, rating, comment, customer_name, created_at)
--     src/app/[lang]/(site)/crafts/requests/page.tsx:57  and
--     src/app/[lang]/(site)/crafts/requests/[id]/page.tsx:61
--         craft_reviews(id)
-- The column is write-only from the app's point of view -- the single
-- reference is the insert at src/components/crafts/craft-review-form.tsx:54.
-- So the browser roles lose SELECT on it and nothing on screen changes.
--
-- NOT FIXED HERE: reviews.customer_id, product_reviews.customer_id,
-- product_questions.asker_id. All three ARE selected today, by public
-- storefront reads that run as `anon`:
--     src/app/[lang]/(site)/store/[id]/page.tsx:191
--         "id, customer_id, customer_name, rating, comment, reply, reply_at"
--     src/lib/data/product-reviews.ts:30
--         "id, rating, comment, photos, customer_name, verified, created_at, customer_id"
--     src/lib/data/product-qa.ts:19
--         "id, asker_id, asker_name, question, answer, created_at"
-- In all three the column exists only to compute an "is this review mine"
-- boolean in the browser (store-reviews.tsx:34, product-reviews.ts:60,
-- product-qa.ts:39). Revoking it would 42501 the whole request, and all three
-- swallow the error with `?? []` -- the storefront would silently lose its
-- reviews block, its rating histogram, its verified-purchase badge and its
-- Q&A, with nothing in the logs. That is a worse outcome than the leak.
--
-- The unblock is small and lives in the app, not here: pass the viewer's id
-- into the query instead of shipping every reviewer's id to the browser, and
-- compute `isMine` server-side. The viewer's id is already in hand at
-- store/[id]/page.tsx:179 and product/[id]/page.tsx:228-229. Two of the three
-- files (src/lib/data/*) are outside this change's remit, so the revoke has to
-- follow that edit rather than lead it. Tracked in ISSUES.csv, not half-done
-- here -- the same call 0274 made about the storage bucket.
--
-- ---------------------------------------------------------------------------
-- WHY COLUMN GRANTS AND NOT A VIEW OR A POLICY SPLIT
-- ---------------------------------------------------------------------------
-- A policy split cannot do it: RLS filters rows, and the requirement is to
-- hide one column of rows that must stay publicly visible. A public view would
-- work but only if the app queried the view, and the app queries the table by
-- name from PostgREST -- so a view is the same app change as above, plus a
-- second object to keep in sync. Column grants are the only option that needs
-- no client change at all, which is the only reason craft_reviews can be done
-- today and the other three cannot.
--
-- TRAP, found by testing rather than reading: `revoke select (customer_id) ...`
-- on its own is a NO-OP here. Column-level revoke only withdraws column-level
-- grants; the table-level SELECT that anon and authenticated already hold
-- still covers every column. Measured: after that statement alone, anon read
-- customer_id fine. The working form is to withdraw the table grant and hand
-- back the columns that are allowed, which is what runs below.

revoke select on public.craft_reviews from anon, authenticated;
grant select (id, provider_id, request_id, rating, comment, created_at, customer_name)
  on public.craft_reviews to anon, authenticated;

comment on column public.craft_reviews.customer_id is
  'MP-010: not readable by anon or authenticated. The public projection of a '
  'review carries customer_name and no account id. Still writable on insert '
  '(the RLS check compares it to auth.uid()) and still readable by '
  'service_role and by the table owner.';

-- ============================================================================
-- ROLLED-BACK TEST (run against production inside begin;...rollback; -- PASSED)
-- ============================================================================
-- 12 assertions, 12 PASS. A provider, a completed craft_request and a review
-- were seeded inside the transaction, since craft_reviews is empty in
-- production today.
--   PASS  anon SELECT id, rating, comment, customer_name, created_at -> 1 row
--   PASS  anon SELECT customer_id                        -> 42501
--   PASS  anon SELECT *                                  -> 42501
--   PASS  authenticated SELECT customer_id               -> 42501
--   PASS  authenticated INSERT own review still succeeds (the insert policy's
--         `customer_id = auth.uid()` check is unaffected -- policy expressions
--         are not column-privilege-checked, only the caller's own column list)
--   PASS  author UPDATE of own review still affects 1 row (craft_reviews_own_update
--         reads customer_id in USING and still works)
--   PASS  super_admin UPDATE (moderation) still affects 1 row
--   PASS  anon craft_providers + craft_reviews embed, the profile page shape
--   PASS  authenticated craft_requests + craft_reviews(id) embed
--   PASS  table owner still reads customer_id
--   PASS  service_role still holds SELECT on customer_id
--   PASS  sync_craft_rating trigger still recomputed the provider's rating_count
