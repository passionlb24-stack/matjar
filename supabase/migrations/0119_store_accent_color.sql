-- Per-store brand color. The storefront's primary color (buttons, badges, section
-- accents) is driven by the CSS var --primary (globals.css: --color-primary maps
-- to it). Giving a store its own accent_color lets the store page override --primary
-- on its own container, so the whole storefront adopts the merchant's brand — a
-- lightweight, safe "theme" (no theming engine). Null = the platform default blue.
-- Stored as a #RRGGBB hex; validated so the store page can trust it verbatim.
alter table public.stores add column if not exists accent_color text;

alter table public.stores
  drop constraint if exists stores_accent_color_chk;
alter table public.stores
  add constraint stores_accent_color_chk
  check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');
