-- (1) Pro upgrade request now captures a phone so the admin can call the
-- merchant back. Existing store owner requests Pro for THEIR store (no new store).
-- Applied to production via Supabase migration `pro_request_phone_and_leader_notify`.
drop function if exists public.request_pro_upgrade(uuid);
create or replace function public.request_pro_upgrade(p_store_id uuid, p_phone text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_owner uuid;
begin
  select name, owner_id into v_name, v_owner from public.stores where id = p_store_id;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() then raise exception 'not_authorized'; end if;
  insert into public.notifications (user_id, type, data)
  select p.id, 'pro_request',
         jsonb_build_object('store_id', p_store_id, 'store_name', v_name, 'phone', nullif(trim(p_phone), ''))
  from public.profiles p where p.role = 'super_admin';
end $$;
revoke execute on function public.request_pro_upgrade(uuid, text) from public, anon;
grant execute on function public.request_pro_upgrade(uuid, text) to authenticated;

-- (2) When a business leader submits their profile (unpublished), notify every
-- super admin so it reaches them (they review/publish at /admin/leaders).
create or replace function public.notify_leader_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published = false then
    insert into public.notifications (user_id, type, data)
    select p.id, 'leader_submission',
           jsonb_build_object('leader_id', new.id, 'name', new.name)
    from public.profiles p where p.role = 'super_admin';
  end if;
  return new;
end $$;
drop trigger if exists business_leaders_notify_admin on public.business_leaders;
create trigger business_leaders_notify_admin
  after insert on public.business_leaders
  for each row execute function public.notify_leader_submission();
