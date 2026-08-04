-- PENDING — deliberately NOT in supabase/migrations/, because it needs a decision
-- from you and would otherwise fail `supabase db push` on purpose.
--
-- Move it to supabase/migrations/0213_plans_alignment.sql once the prices below
-- are filled in.
--
-- ── What the database actually says (checked 2026-08-04) ────────────────────
--   store_plan enum : free, basic, pro, business      (4 values)
--   plans table     : free  $0 / $0
--                     pro   $12 monthly / $120 yearly (2 rows — basic and
--                                                      business have NO row)
--   stores.plan     : free 18 · pro 10 · business 3
--   subscriptions   : 0 rows
--   payments        : 0 rows
--
-- ── What the feature-expansion prompt assumes ──────────────────────────────
--   Basic     $10 / $120
--   Pro       $25 / $300
--   Business  $65 / $780
--
-- These disagree. Pro is $12 in the database and $25 in the prompt. Three stores
-- are already flagged 'business' against a plan row that does not exist, so they
-- are on a tier with no price attached to it.
--
-- Every gating decision in the expansion prompt rests on this table, which is why
-- this is not something to guess at.
--
-- ── The larger point ───────────────────────────────────────────────────────
-- subscriptions = 0 and payments = 0. The 13 stores on pro/business were set by
-- hand. Until stores.plan is driven by a paid subscription row, gating a feature
-- behind a tier gates nothing at all — which makes the tier matrix in the prompt
-- decoration rather than enforcement. That is application work, not a migration,
-- and it is worth more than any of the eight features the prompt proposes.

do $$
declare
  -- ▼ set these four, then move this file into supabase/migrations/ ▼
  v_basic_monthly numeric := null;
  v_basic_yearly numeric := null;
  v_business_monthly numeric := null;
  v_business_yearly numeric := null;
begin
  if v_basic_monthly is null or v_business_monthly is null then
    raise exception 'Set the plan prices at the top of this file before running it.';
  end if;

  insert into public.plans (slug, name_ar, name_en, price_monthly, price_yearly, is_active, sort_order)
  values ('basic', 'أساسي', 'Basic', v_basic_monthly, v_basic_yearly, true, 1)
  on conflict (slug) do update
    set price_monthly = excluded.price_monthly,
        price_yearly = excluded.price_yearly,
        is_active = true;

  insert into public.plans (slug, name_ar, name_en, price_monthly, price_yearly, is_active, sort_order)
  values ('business', 'أعمال', 'Business', v_business_monthly, v_business_yearly, true, 3)
  on conflict (slug) do update
    set price_monthly = excluded.price_monthly,
        price_yearly = excluded.price_yearly,
        is_active = true;
end $$;

-- Guard: every store_plan value must have a plans row, or a store can sit on a
-- tier the catalogue has never heard of — which is the state 'business' is in now.
do $$
declare v_missing text;
begin
  select string_agg(e.enumlabel, ', ')
  into v_missing
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'store_plan'
    and not exists (select 1 from public.plans p where p.slug = e.enumlabel);

  if v_missing is not null then
    raise exception 'store_plan values with no plans row: %', v_missing;
  end if;
end $$;
