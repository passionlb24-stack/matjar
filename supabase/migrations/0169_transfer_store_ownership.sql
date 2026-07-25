-- Store ownership transfer: the current owner hands the whole store to another
-- account by email. Built for the "I set the store up FOR someone" flow — an
-- agency/founder opens and fills a store, then transfers it; the recipient
-- becomes the owner (full admin) and the giver loses all access.
--
-- Direct UPDATE of stores.owner_id is impossible through RLS on purpose
-- (stores_update_own's WITH CHECK pins owner_id = auth.uid()), so this is a
-- guarded SECURITY DEFINER RPC:
--   · caller must be the CURRENT owner (or super_admin) — staff cannot transfer
--   · target must already have an account (looked up by email, like add_store_staff)
--   · everything else (products, orders, plan, slug…) references store_id and
--     follows the store automatically — nothing to migrate
--   · the recipient is promoted customer→merchant (mirrors the 0078 trigger),
--     their staff row on this store (if any) is removed, and they get an
--     in-app notification

create or replace function public.transfer_store_ownership(
  p_store_id uuid,
  p_email text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_target uuid;
  v_store_name text;
begin
  select owner_id, name into v_owner, v_store_name
    from public.stores where id = p_store_id;
  if v_owner is null then return 'not_found_store'; end if;

  -- Owner-only (staff explicitly cannot give the store away).
  if not (v_owner = auth.uid() or public.is_super_admin()) then
    return 'not_owner';
  end if;

  select id into v_target from auth.users
    where lower(email) = lower(btrim(p_email)) limit 1;
  if v_target is null then return 'not_found'; end if;
  if v_target = v_owner then return 'self'; end if;

  update public.stores set owner_id = v_target where id = p_store_id;

  -- The new owner needs no staff row on their own store.
  delete from public.store_staff
    where store_id = p_store_id and user_id = v_target;

  -- Owning a store makes you a merchant (same promotion as store creation).
  update public.profiles set role = 'merchant'
    where id = v_target and role = 'customer';

  insert into public.notifications (user_id, type, data)
  values (v_target, 'store_transferred',
          jsonb_build_object('store_id', p_store_id, 'store_name', v_store_name));

  return 'ok';
end $$;

revoke execute on function public.transfer_store_ownership(uuid, text) from public, anon;
grant execute on function public.transfer_store_ownership(uuid, text) to authenticated;
