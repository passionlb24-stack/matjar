-- 0300 — a pharmacy stops advertising itself to labs
--
-- ###########################################################################
-- ##  STEP 1 APPLIED. STEP 2 IS THE OWNER'S CALL.                          ##
-- ##                                                                       ##
-- ##  Step 1 (the pharmacy row) ran on 2026-08-20. It rewrites the exact   ##
-- ##  seed wording shipped by 0124, which nobody has ever edited, and it   ##
-- ##  is the actual defect: the sector that cannot book anything was       ##
-- ##  inviting labs in by name. Zero stores sit under `pharmacy`, so it    ##
-- ##  changed nothing anybody owns.                                        ##
-- ##                                                                       ##
-- ##  Step 2 (the healthcare row) is NOT applied, and not because it is    ##
-- ##  risky — it is a label on a taxonomy row and nothing in src matches   ##
-- ##  on it. It is unapplied because it overwrites wording a HUMAN typed:  ##
-- ##  name_ar was hand-changed on 2026-07-17 and is not the 0003 seed. The ##
-- ##  case for changing it anyway is in the block below and I think it is  ##
-- ##  a good one, but "an agent silently renamed a sector somebody named"  ##
-- ##  is not a thing to find out about later. Run step 2 with the Supabase ##
-- ##  MCP (apply_migration) if you agree with the reasoning.               ##
-- ###########################################################################
--
-- MJ-009. "Pharmacy and lab conflated in one commerce sector; a lab test is sold
-- as a box of medicine." The audit row proposes splitting `lab` out of
-- `pharmacy`. That split is right, and this is the cheapest moment it will ever
-- have: production holds ZERO stores under `pharmacy`, so there is nothing to
-- strand. It is NOT done in this migration, and the reason is in the code, not
-- the data — a new CategoryKey is not local to the sector registry. Two
-- exhaustive `Record<CategoryKey, …>` tables live in src/lib/discovery.ts
-- (`sectorDiscovery`, `CARD_FACTS`) and one in src/components/category-icon.tsx;
-- a key added without entries there fails `tsc`, and a sector that half-exists
-- is worse than the conflation. The split belongs in one change that owns those
-- files.
--
-- What this migration does is stop the conflation at the only door a merchant
-- walks through. `business_types.name_ar/name_en` is the label on the sector
-- picker in /merchant/new (it reads the row directly — see the page: `label:
-- lang === "ar" ? t.name_ar : t.name_en`). The pharmacy row has said
-- "صيدليات ومختبرات" / "Pharmacies & labs" since 0124, so a lab owner is
-- explicitly invited into a bundle with a cart, stock and POS and no scheduling
-- module whatsoever. The clinic row — which DOES carry `appointments`, `team`
-- and `verifications`, i.e. everything a lab actually needs — never mentions
-- labs at all.
--
-- So: the word moves. Pharmacies are pharmacies; labs are pointed at the sector
-- that can already book them an appointment. No schema change, no function
-- signature, nothing a deployed build calls — only two label columns on the
-- platform's own taxonomy rows.
--
-- Deploy ordering: safe in either direction, which is why it is written as a
-- plain update rather than staged. The DEPLOYED build reads these columns only
-- to print them; nothing in src matches on their contents (grepped). This branch
-- also changes the parallel customer-facing strings in
-- dict.catalog.{pharmacy,healthcare}, so between applying this and deploying the
-- branch the picker and the category page disagree on wording for two sectors.
-- That is cosmetic and self-healing — not the class of mistake that took the
-- reviews block off every store page, where the DB stopped answering a question
-- the running code was still asking.
--
-- Idempotent and non-clobbering: each update is guarded on the value the row
-- actually holds in production right now, so re-running is a no-op.
--
-- One thing the guard turned up, worth recording because it was not obvious.
-- The healthcare row does not hold its 0003 seed: its name_ar was changed to
-- 'صحة وجمال' — "Health & BEAUTY" — on 2026-07-17, while its name_en still says
-- "Health & clinics". The two columns have contradicted each other since, and
-- the dates say why: `beauty` did not exist as its own business type until
-- 2026-07-20. The Arabic was right when clinics and salons shared one sector and
-- was simply never narrowed when they stopped. So this is not an admin's
-- deliberate wording being overruled — it is a label that outlived its sector,
-- and the English half of the same row already disagrees with it.

-- ===== STEP 1 (APPLIED 2026-08-20) =====
-- The pharmacy sells stock off a shelf. Nothing here books anything.
update public.business_types
   set name_ar = 'صيدليات',
       name_en = 'Pharmacies',
       updated_at = now()
 where slug = 'pharmacy'
   and name_ar = 'صيدليات ومختبرات'
   and name_en = 'Pharmacies & labs';

-- ===== STEP 2 (NOT APPLIED — see the header) =====
-- The clinic sector already runs the appointment engine a lab needs; say so, so
-- a lab owner can find it — and settle the ar/en contradiction described above
-- in the direction both this branch's dictionary and the row's own English take.
-- Guarded on name_en, which is still untouched since 0003; name_ar is asserted
-- to be one of the two wordings this row has ever held, so a third value that
-- somebody chose deliberately after this is written is left alone.
update public.business_types
   set name_ar = 'عيادات ومختبرات',
       name_en = 'Clinics & labs',
       updated_at = now()
 where slug = 'healthcare'
   and name_en = 'Health & clinics'
   and name_ar in ('صحة وعيادات', 'صحة وجمال');

-- Verification (run in a rolled-back transaction before applying):
--
--   begin;
--     -- …the two updates above…
--     select slug, name_ar, name_en from public.business_types
--      where slug in ('pharmacy','healthcare');
--     -- expect: pharmacy → صيدليات / Pharmacies                  (1 row updated)
--     --         healthcare → عيادات ومختبرات / Clinics & labs      (1 row updated)
--     select count(*) from public.stores s
--       join public.business_types bt on bt.id = s.business_type_id
--      where bt.slug = 'pharmacy';
--     -- expect 0 — no store is affected by any of this
--   rollback;
