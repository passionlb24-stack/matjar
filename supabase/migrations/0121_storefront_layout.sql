-- Storefront layout template. The store page already auto-picks grid (retail) vs
-- a menu-style row list (food) by sector; this lets the merchant OVERRIDE that and
-- also choose a third "showcase" (big-image) look for boutique/fashion. Null keeps
-- the sector default (no regression). Validated so the store page can trust it.
--   grid     — product cards in a responsive grid (default for retail)
--   menu     — compact rows with a thumbnail (menu-style, default for food)
--   showcase — large image-forward cards, few per row (boutique/fashion)
alter table public.stores add column if not exists storefront_layout text;

alter table public.stores
  drop constraint if exists stores_storefront_layout_chk;
alter table public.stores
  add constraint stores_storefront_layout_chk
  check (storefront_layout is null
         or storefront_layout in ('grid', 'menu', 'showcase'));
