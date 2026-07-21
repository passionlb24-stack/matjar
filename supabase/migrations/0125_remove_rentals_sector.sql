-- Rentals is no longer a top-level sector — it became a toggleable feature module
-- (FeatureModuleKey 'rentals' in src/lib/modules-catalog.ts) that any sector can
-- switch on via store_modules. Remove the standalone business_type so it stops
-- appearing as its own sector in creation/explore. Any store still on it is
-- repointed to the generic `retail` sector first so no store is orphaned.
-- Applied to production via Supabase migration `remove_rentals_sector_now_a_module`.

update public.stores s
  set business_type_id = (select id from public.business_types where slug = 'retail')
  where business_type_id = (select id from public.business_types where slug = 'rentals');

delete from public.business_types where slug = 'rentals';
