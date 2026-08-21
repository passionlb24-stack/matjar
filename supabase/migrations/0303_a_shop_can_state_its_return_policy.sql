-- MJ-015's other half. The row asked for a size guide, product measurements and
-- a structured return policy.
--
-- The size guide was declined and stays declined: it needs a per-store
-- measurement table and a merchant form, there is no fashion subvertical, the
-- largest clothing store has three items, and zero products fill the
-- `dimensions` field that already exists. It would ship as an empty tab.
--
-- The return policy is different — it is one sentence every shop already has in
-- its head, and a customer deciding whether to order from a shop they have
-- never used is exactly who needs it.
--
-- Free text, deliberately, not a structured {days, condition, who_pays} rule.
-- Matjar takes no payment and settles nothing: a structured return window would
-- read as a platform guarantee, and the platform cannot make one. The shop says
-- what it does, in its own words, and the shop is the one who honours it. Same
-- reasoning as the rental deposit in 0298 — display what the merchant states,
-- never imply the platform is a party to it.
--
-- Verified before applying, in a rolled-back transaction against an ACTIVE store
-- so the anon read tested the grant rather than the status filter:
--   owner UPDATE            -> 1 row
--   products-only staff     -> 0 rows   (stores_update is owner-only, per 0302)
--   anon SELECT             -> reads it (storefront can render it)
--   anon column privilege   -> true
--
-- The first run of that probe used a non-active store and anon read NULL, which
-- looked like a missing grant and was actually RLS filtering the row. Worth
-- recording: on `stores`, "cannot read the column" and "cannot see the row" wear
-- the same NULL.

alter table public.stores add column if not exists return_policy text;

comment on column public.stores.return_policy is
  'The shop''s own returns policy, in its own words. Merchant-authored free text, not a structured rule the platform enforces — Matjar takes no payment and settles nothing, so a machine-readable return window would be a promise the platform cannot keep. Rendered on the storefront when set; the section is absent when it is not, rather than showing a default nobody agreed to.';
