-- Multi-sector expansion, batch 2. Remaining new sectors from the registry.
-- (pharmacy sits under the Health group; farm is sort 18 because 17 was the old
-- `rentals` sector, which 0125 removes in favour of a toggleable module.)
-- Applied to production via Supabase migration `add_sector_business_types_batch_2`.

insert into public.business_types (slug, name_ar, name_en, icon, sort_order)
values
  ('events',       'مناسبات وقاعات',     'Events & venues',       'party-popper', 11),
  ('hospitality',  'فنادق وشاليهات',     'Hotels & chalets',      'bed-double',   12),
  ('pharmacy',     'صيدليات ومختبرات',   'Pharmacies & labs',     'pill',         13),
  ('petCare',      'عناية بالحيوانات',   'Pet care',              'paw-print',    14),
  ('professional', 'خدمات مهنية',        'Professional services', 'scale',        15),
  ('contractors',  'مقاولات وحرفيّون',   'Contractors & trades',  'hard-hat',     16),
  ('farm',         'مزارع ومنتجات محلية', 'Farms & local produce', 'sprout',       18)
on conflict (slug) do update
  set name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      icon    = excluded.icon,
      sort_order = excluded.sort_order;
