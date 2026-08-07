-- 0232: staff permissions start meaning something.
--
-- Three findings, one model. The database has two membership tests:
--
--   staff_can(store, perm)  owner, or staff holding that named permission
--   can_manage_store(store) owner, or ANY staff row at all — no permission read
--
-- can_manage_store is the gate on ~60 policies, so a clerk hired with nothing
-- but "products" ticked passed every one of them. The permission checkboxes
-- were decoration wherever that function stood.
--
-- 1. Staff could not see order line items.
--    order_items_select allowed the customer and the store OWNER only, so a
--    staff member hired to work the orders queue saw the order and none of its
--    contents. The one job the permission exists for was the job it did not
--    grant. staff_can(store,'orders') is added — narrower than the
--    can_manage_store used elsewhere, deliberately.
--
-- 2. Configuration was open to any staff member.
--    Verifications (the store's legal identity), payment/checkout fields,
--    delivery zones and enabled modules all sat behind can_manage_store, so the
--    products clerk could rewrite the business. These move to a new
--    is_store_owner() — strictly the owner.
--
-- The rest of can_manage_store is left alone on purpose: for reads, and for the
-- everyday tables staff are hired to work, "is on the team" is the right test.
-- Narrowing all sixty at once would lock working merchants out of their own
-- dashboards to fix a problem that lives in a handful of them.
--
-- Verified on production inside rolled-back transactions:
--   staff with {"orders":true}   → sees order_items          (saw none before)
--   staff with {"products":true} → refused on store_verifications
--   owner                        → still manages verifications

-- 1 ---------------------------------------------------------------------------
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = (select auth.uid())
          or exists (select 1 from public.stores s
                      where s.id = o.store_id and s.owner_id = (select auth.uid()))
          or public.staff_can(o.store_id, 'orders')
        )
    )
  );

-- 2 ---------------------------------------------------------------------------
create or replace function public.is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select exists (select 1 from public.stores s
                 where s.id = p_store_id and s.owner_id = (select auth.uid()));
$function$;

comment on function public.is_store_owner(uuid) is
  'Strictly the owner. can_manage_store() also returns true for any staff row '
  'regardless of permissions, which is right for "may open the dashboard" and '
  'wrong for "may reconfigure the business".';

do $do$
declare r record;
begin
  for r in
    select unnest(array[
      'store_verifications:store_verifications_manage',
      'store_verification_docs:store_verification_docs_manage',
      'store_modules:store_modules_manage',
      'store_checkout_fields:checkout_fields_write',
      'store_delivery_zones:delivery_zones_manage'
    ]) as spec
  loop
    execute format('drop policy if exists %I on public.%I',
                   split_part(r.spec, ':', 2), split_part(r.spec, ':', 1));
    execute format(
      'create policy %I on public.%I for all
         using (public.is_store_owner(store_id) or public.is_super_admin())
         with check (public.is_store_owner(store_id) or public.is_super_admin())',
      split_part(r.spec, ':', 2), split_part(r.spec, ':', 1));
  end loop;
end
$do$;
