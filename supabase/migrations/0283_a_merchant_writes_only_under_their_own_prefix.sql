-- MP-011. `store_assets_auth_insert` was `with check (bucket_id = 'store-assets')`
-- and nothing else, so any signed-in user could create an object anywhere in the
-- public bucket — including under another merchant's store-id prefix, and under
-- `verifications/<someone else's store>/`.
--
-- 0077 capped size and MIME but deferred path scoping; 0274 wrote down exactly
-- why (the paths are not uniform, so one copied `digital_goods_owner_write`
-- would silently reject most of them). This migration does the deferred half by
-- teaching the check every shape the deployed app actually uses, rather than
-- assuming one.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY EXPLOITABLE (measured against production, not read off)
-- ---------------------------------------------------------------------------
-- REAL: insert into any prefix. Proven in a rolled-back transaction — as a
-- merchant who owns store 7bad6103, `insert into storage.objects` succeeded for
-- `114963e6…/x.jpg` (a competitor's store) and for `anything/x.jpg`.
--
-- NOT REAL: the "move your own object over a competitor's path" half of the
-- issue. `store_assets_owner_update` has no `with check`, so its `using`
-- clause doubles as the check — but the bucket deliberately has NO select
-- policy (0008 says so on purpose: a select policy would let anyone list every
-- filename). Postgres applies select policies to the rows an UPDATE's WHERE
-- clause reads, so `authenticated` sees zero rows in this bucket and every
-- UPDATE and DELETE matches nothing. Measured: as the uploader of an existing
-- object, `select count(*)` = 0, `update … where name = <their own object>`
-- affected 0 rows, and `delete` is refused outright by storage.protect_delete.
-- The `on conflict do update` path (storage upsert) is refused too. So no
-- merchant could overwrite a competitor's image; they could only plant new
-- files under a competitor's prefix. The insert policy is still the whole hole
-- and is still worth closing — the claim about UPDATE just is not true here.
--
-- ---------------------------------------------------------------------------
-- WHY `can_manage_store`, NOT `is_store_owner`
-- ---------------------------------------------------------------------------
-- `digital_goods_owner_write` (0234) is the pattern this follows: first path
-- segment must be a store you hold. The predicate differs on purpose. Every
-- upload screen lives under /merchant/[storeId]/*, whose layout gates on
-- `can_manage_store` — owner OR store_staff. Copying `is_store_owner` verbatim
-- would lock every staff member out of adding a product image. Proven below:
-- the one real store_staff row can write its own store and nothing else.
-- Super admins are allowed through, matching the `… or is_super_admin()`
-- idiom 0274 uses across the HR tables.
--
-- ---------------------------------------------------------------------------
-- THE PATH SHAPES. Every ImageUpload/GalleryUpload `folder` prop on this
-- branch (20 call sites, src/components/*), and what scopes each:
--   <storeId>/…                    can_manage_store  (bundle-manager,
--                                  doctor-manager, edit-store-form,
--                                  product-form, product-edit-form)
--   portfolio/<storeId>/…          can_manage_store  (portfolio-manager)
--   services/<storeId>/…           can_manage_store  (service-form)
--   verifications/<storeId>/…      can_manage_store  (verifications-manager)
--   crafts/<userId>/…              = auth.uid()      (craft-join-form)
--   crafts/<providerId>/works/…    craft_providers.user_id = auth.uid()
--                                  (craft-works-manager — note providerId is
--                                  craft_providers.id, a DIFFERENT id space
--                                  from the userId one segment above it)
--   gigs/… listings/… reviews/… wholesale/…
--                                  any authenticated caller. These four carry
--                                  no identity in the path at all, so no policy
--                                  can scope them; they stay open to signed-in
--                                  users and are now the ONLY prefixes that
--                                  are. Narrowing them needs a client change
--                                  (put the uid in the path) and is not done
--                                  here.
--
-- EXISTING OBJECTS: 104 in the bucket — 91 under a store-id prefix (all 91
-- resolve to a real store), 8 under `listings/`, 5 under `gigs/`. Nothing sits
-- at a path this policy forbids, so nothing is orphaned for writing. 13 of the
-- 91 were uploaded by a user who is no longer the store's owner (both stores
-- were transferred to one account); those 13 stay readable and stay servable by
-- public URL, and their original uploader loses a theoretical UPDATE right they
-- could not exercise anyway (see NOT REAL above).

create or replace function public.can_write_store_asset(p_name text)
returns boolean
language plpgsql
stable
set search_path = ''
as $fn$
declare
  seg1 text := split_part(p_name, '/', 1);
  seg2 text := split_part(p_name, '/', 2);
  uid  uuid := (select auth.uid());
  uuid_re constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if uid is null then return false; end if;
  if public.is_super_admin() then return true; end if;
  -- Every legitimate path has at least one slash; a bare filename has none.
  if seg2 = '' then return false; end if;

  -- <storeId>/…
  if seg1 ~* uuid_re then
    return public.can_manage_store(seg1::uuid);
  end if;

  -- portfolio|services|verifications/<storeId>/…
  if seg1 in ('portfolio', 'services', 'verifications') then
    return seg2 ~* uuid_re and public.can_manage_store(seg2::uuid);
  end if;

  -- crafts/<userId>/…  and  crafts/<providerId>/works/…
  if seg1 = 'crafts' then
    if seg2 !~* uuid_re then return false; end if;
    return seg2::uuid = uid
        or exists (select 1 from public.craft_providers cp
                   where cp.id = seg2::uuid and cp.user_id = uid);
  end if;

  -- Identity-free shared prefixes.
  if seg1 in ('gigs', 'listings', 'reviews', 'wholesale') then
    return true;
  end if;

  -- The uuid casts above are reached only after the regex has matched, so an
  -- unexpected prefix returns false instead of raising 22P02 and aborting the
  -- caller's statement. (digital_goods_owner_write casts unguarded; this one
  -- has to survive four literal prefixes, so it cannot.)
  return false;
end;
$fn$;

-- SECURITY INVOKER on purpose: can_manage_store must see store_staff through
-- the CALLER's RLS, which store_staff_select already permits for your own row.
-- Stated audience anyway, per 0281's convention.
revoke all on function public.can_write_store_asset(text) from public, anon, authenticated;
grant execute on function public.can_write_store_asset(text) to authenticated;

drop policy if exists "store_assets_auth_insert" on storage.objects;
create policy "store_assets_auth_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-assets'
    and public.can_write_store_asset(name)
  );

-- The UPDATE policy gains the `with check` it never had. `using` is unchanged,
-- so nobody loses a row they could already reach; the check simply refuses a
-- rename that would land the object under a prefix the caller may not write.
drop policy if exists "store_assets_owner_update" on storage.objects;
create policy "store_assets_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'store-assets'
    and owner = (select auth.uid())
  )
  with check (
    bucket_id = 'store-assets'
    and owner = (select auth.uid())
    and public.can_write_store_asset(name)
  );

-- store_assets_owner_delete is deliberately untouched: it is already scoped to
-- the uploader, and storage.protect_delete refuses direct deletes regardless.

-- ============================================================================
-- ROLLED-BACK TEST (run against production inside begin;…rollback; — PASSED)
-- ============================================================================
-- 23 assertions, 23 PASS. Actors: merchant A (owns 7bad6103), merchant B
-- (owns 114963e6), the one real store_staff member (store a3f06524), a
-- super_admin, and anon. A seeded craft_providers row supplied the provider-id
-- case (the table is empty in production today).
--
--   ALLOW  own store prefix                     ALLOW  gigs/ listings/
--   DENY   another store prefix                        reviews/ wholesale/
--   ALLOW  portfolio/services/verifications     DENY   arbitrary prefix
--          under own store                      DENY   bare filename, no slash
--   DENY   the same three under another store   DENY   ../<other store>/…
--   ALLOW  crafts/<own uid>/…                   ALLOW  staff writes its store
--   DENY   crafts/<other uid>/…                 DENY   staff writes another
--   ALLOW  crafts/<own provider id>/works/…     ALLOW  super admin anywhere
--   DENY   crafts/<other's provider id>/works/… DENY   anon writes anything
--   ALLOW  digital-goods unaffected
--
-- Before the change, for comparison, the same harness recorded ALLOWED for
-- "insert into ANOTHER store prefix" and "insert into ARBITRARY prefix".
