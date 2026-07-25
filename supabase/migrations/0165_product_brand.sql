-- Product brand (Salla parity: "الماركات التجارية"). A light free-text brand on
-- a product powers a brand chip on the product page and a brand filter on the
-- storefront — useful for fashion / electronics / perfume stores. Kept as plain
-- text (not a brands table) to stay simple; can be normalised later if needed.

alter table public.products
  add column if not exists brand text;

-- Trigram index so a future brand search/filter stays fast as catalogs grow.
create index if not exists products_brand_trgm_idx
  on public.products using gin (lower(brand) gin_trgm_ops)
  where brand is not null;
