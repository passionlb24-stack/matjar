-- 0296 — a service has one duration, not two
--
-- ###########################################################################
-- ##  STEP 1 APPLIED. STEP 2 IS PENDING A DEPLOY.                           ##
-- ##                                                                        ##
-- ##  The backfill (step 1) ran on 2026-08-20: all seven services now carry ##
-- ##  duration_minutes, and the booking engine can finally see the six it   ##
-- ##  could not. That half is additive and safe against any build.          ##
-- ##                                                                        ##
-- ##  Step 2 — stripping attributes->>'duration' — must NOT run until this  ##
-- ##  branch is deployed. The DEPLOYED build resolves the visit length from ##
-- ##  the jsonb field; the column-first fallback in                         ##
-- ##  store/store-healthcare-info.tsx exists only here. Removing the key    ##
-- ##  now blanks "مدّة الزيارة" on both live clinic pages until the deploy    ##
-- ##  lands — the same ordering mistake that took the reviews block off     ##
-- ##  every store page earlier today.                                       ##
-- ##  It rewrites live merchant rows, so it is the store owner's call, not  ##
-- ##  an agent's. Apply with the Supabase MCP (apply_migration) after        ##
-- ##  reading the verification block at the foot of this file.              ##
-- ###########################################################################
--
-- WHAT IS WRONG
--
-- `products.duration_minutes` is the column the booking engine reads when it
-- lays out a day's slots. `products.attributes->>'duration'` is an older jsonb
-- field that predates it. Both were offered on the create form at the same
-- time, under labels a merchant cannot tell apart ("المدّة" twice), so which
-- one a clinic filled was a coin toss.
--
-- In production on 2026-08-20 the coin landed six to one:
--
--   أشعة            attributes.duration = 30   duration_minutes = null
--   ايكو            attributes.duration = 30   duration_minutes = null
--   تحاليل          attributes.duration = 20   duration_minutes = null
--   مراجعة طبية      attributes.duration = 20   duration_minutes = null
--   فحص للعملية      attributes.duration = 30   duration_minutes = null
--   كشفية فحص نظر    attributes.duration = 30   duration_minutes = null
--   تنظيف اسنان      attributes.duration = null duration_minutes = 30
--
-- Six clinic services carry a duration the booking engine cannot see. The
-- application side of this is already fixed: the field is marked `legacy` in
-- src/lib/attributes.ts, so neither form offers it again and no seventh row can
-- join them. This migration is the other half — moving what is already stored
-- into the column that is read.
--
-- WHAT IT DOES
--
--  1. For every product with a numeric `attributes->>'duration'` and no
--     `duration_minutes`, copy the value into the column.
--  2. Strip the `duration` key from `attributes` once it is safely copied.
--
-- It never overwrites a duration_minutes that is already set: where a merchant
-- filled both, the column is the one the engine has been honouring all along
-- and the jsonb copy is the stale one. Those rows keep the column and lose the
-- duplicate.
--
-- Idempotent: re-running finds no rows left matching the WHERE clause.

begin;

-- 1. Backfill the column from the jsonb field.
update products
set duration_minutes = (attributes ->> 'duration')::int
where attributes ? 'duration'
  and duration_minutes is null
  and attributes ->> 'duration' ~ '^[0-9]+$'
  and (attributes ->> 'duration')::int > 0;

-- 2. Retire the jsonb key. Restricted to rows whose duration is now safely in
--    the column — a non-numeric value ("half an hour", "٣٠") is left in place
--    rather than silently binned, so it can be looked at by a human.
update products
set attributes = attributes - 'duration'
where attributes ? 'duration'
  and duration_minutes is not null
  and attributes ->> 'duration' ~ '^[0-9]+$'
  and (attributes ->> 'duration')::int = duration_minutes;

commit;

-- VERIFY (run inside begin; … rollback; first, per house style)
--
--   select count(*) filter (where attributes ? 'duration')          as still_in_jsonb,
--          count(*) filter (where duration_minutes is not null)     as in_column,
--          count(*) filter (where attributes ? 'duration'
--                             and duration_minutes is null)         as orphaned
--   from products
--   where item_kind = 'service';
--
-- Expected after applying: still_in_jsonb = 0, in_column = 7, orphaned = 0.
-- Any `orphaned` row is a non-numeric duration that needs reading by hand.
--
-- AFTER THIS IS APPLIED
--
-- The `duration` entry in `categoryAttributes` (src/lib/attributes.ts, marked
-- `legacy: true`) can be deleted outright, along with the `legacy` handling in
-- product-edit-form.tsx that carries retired keys across a save. Do not delete
-- it before: until the backfill runs, that entry is the only thing keeping the
-- six durations on screen.
