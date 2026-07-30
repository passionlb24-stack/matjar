-- 0204: Decision-support depth for the user-posted listings (freelance gigs,
-- jobs, wholesale). Each surface only captured a single image + free text, which
-- isn't enough for a buyer/applicant to decide:
--   * a design gig can't be sold from ONE sample image → real work gallery
--   * "what's included" + revisions are the two questions every buyer asks
--   * a job whose how_to_apply is free text can be published with no reachable
--     contact at all (observed live: "التقديم على الايميل:" with no email)
-- Additive only; every column is optional so existing rows stay valid.

-- ── Freelance gigs ──────────────────────────────────────────────────────────
alter table public.gigs
  add column if not exists gallery jsonb,            -- string[] of image urls (work samples)
  add column if not exists includes jsonb,           -- string[] of "what's included" bullets
  add column if not exists revisions int check (revisions is null or revisions >= 0),
  add column if not exists portfolio_link text;      -- ONE optional external portfolio/profile

-- ── Job postings ────────────────────────────────────────────────────────────
alter table public.job_postings
  add column if not exists apply_email text,
  add column if not exists apply_deadline date,
  add column if not exists experience_level text;    -- entry | mid | senior

-- Structured apply email must actually look like an email when present, so a
-- posting can no longer advertise "apply by email" with nothing to write to.
alter table public.job_postings
  drop constraint if exists job_postings_apply_email_format;
alter table public.job_postings
  add constraint job_postings_apply_email_format
  check (apply_email is null or apply_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ── Wholesale ───────────────────────────────────────────────────────────────
alter table public.wholesale_products
  add column if not exists gallery jsonb;
