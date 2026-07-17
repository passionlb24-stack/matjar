-- Bilingual products: optional English overrides for name + description.
-- The storefront shows these when the viewer's language is English and the
-- override is non-empty; otherwise it falls back to the primary (Arabic-first)
-- text the merchant always fills in. Nullable and no RLS change — same row, so
-- the existing product policies already cover reads and writes.

alter table public.products
  add column if not exists name_en text,
  add column if not exists description_en text;
