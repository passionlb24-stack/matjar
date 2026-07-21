-- Multi-sector expansion, batch 1. The homepage/explore grouping and the sector
-- registry (src/lib/sectors.ts) grew from 6 to 17 sectors; every sector's slug
-- must exist as a business_types row (slug === CategoryKey, 1:1) so stores can be
-- created under it. This batch adds the first four new sectors.
-- Applied to production via Supabase migration `add_sector_business_types_beauty_fitness_sports_education`.

insert into public.business_types (slug, name_ar, name_en, icon, sort_order)
values
  ('beauty',       'تجميل وعناية', 'Beauty & care',      'scissors',       7),
  ('fitness',      'لياقة وأندية', 'Fitness & clubs',    'dumbbell',       8),
  ('sportsCourts', 'ملاعب ورياضة', 'Sports & courts',    'trophy',         9),
  ('education',    'تعليم ودورات', 'Education & courses', 'graduation-cap', 10)
on conflict (slug) do update
  set name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      icon    = excluded.icon,
      sort_order = excluded.sort_order;
