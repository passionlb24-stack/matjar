-- Which band of the banner survives the crop.
--
-- The banner is 3:1 everywhere now, but merchants upload what their phone and
-- Canva produce — 16:9, 4:3. A 16:9 photo in a 3:1 frame loses 41% of its
-- height, and a butcher whose shop name sits along the top of the artwork loses
-- the name. Centre-cropping is a guess; this lets the merchant say where to cut
-- instead, and the same number is used by the store page, the search card, and
-- the preview in the merchant form, so all three cut at the same place.
--
-- 0 = keep the top, 50 = centre (the old behaviour, and the default), 100 =
-- keep the bottom. It maps straight onto CSS object-position.
alter table public.stores
  add column if not exists cover_position smallint not null default 50;

alter table public.stores
  drop constraint if exists stores_cover_position_range;
alter table public.stores
  add constraint stores_cover_position_range
  check (cover_position between 0 and 100);
