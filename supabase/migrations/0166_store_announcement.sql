-- Store announcement bar (Salla parity: "الإعلانات"). A short message the
-- merchant can pin to the top of their storefront — a sale, a holiday notice,
-- shipping delays. Pure display, null/empty = off. No effect on pricing/orders.

alter table public.stores
  add column if not exists announcement text;
