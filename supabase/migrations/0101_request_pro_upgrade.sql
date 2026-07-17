-- Upgrade-to-Pro flow. Payment is manual, so a free merchant who hits a Pro
-- gate had no in-app way to actually upgrade — the CTA pushed them toward
-- creating a NEW store instead. This lets the store owner REQUEST an upgrade for
-- THEIR store; every admin gets an in-app notification and can flip the plan.
create or replace function public.request_pro_upgrade(p_store_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_owner uuid;
begin
  select name, owner_id into v_name, v_owner
  from public.stores where id = p_store_id;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() then raise exception 'not_authorized'; end if;

  insert into public.notifications (user_id, type, data)
  select p.id, 'pro_request',
         jsonb_build_object('store_id', p_store_id, 'store_name', v_name)
  from public.profiles p
  where p.role = 'super_admin';
end $$;
revoke execute on function public.request_pro_upgrade(uuid) from public, anon;
grant execute on function public.request_pro_upgrade(uuid) to authenticated;
