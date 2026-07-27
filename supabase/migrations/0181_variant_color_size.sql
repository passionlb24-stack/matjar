-- 0181: apparel variants — colors, and per-color sizes. A variant is still one
-- product_variants row (its own price/stock), but now carries the structured
-- color/size it represents so the storefront can render a color→size picker.
-- Purely additive: legacy flat variants have null color/size and keep working;
-- the order RPC still selects by variant_id + snapshots the label, unchanged.

alter table public.product_variants
  add column if not exists color text,
  add column if not exists size text;
