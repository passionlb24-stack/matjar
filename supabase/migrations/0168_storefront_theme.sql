-- Storefront themes: five complete design systems (classic / minimal / warm /
-- bold / luxe) a merchant picks with one tap. A theme sets DEFAULTS — accent
-- palette, product-list layout, hero anatomy, card/button DNA, typography —
-- while the merchant's own explicit choices (accent_color, storefront_layout)
-- always override the theme's defaults. Null = classic (today's look).

alter table public.stores
  add column if not exists storefront_theme text
  check (storefront_theme in ('classic', 'minimal', 'warm', 'bold', 'luxe'));
