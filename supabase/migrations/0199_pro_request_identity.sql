-- 0199: Pro-upgrade request notifications now identify WHO requested + their
-- contact + trial status, so the admin knows who to call and — because new
-- stores get a 14-day Pro trial — whether they even need to act yet (the request
-- can wait until the trial ends / payment is due). Additive to the RPC payload.
create or replace function public.request_pro_upgrade(p_store_id uuid, p_phone text default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare
  v_name text; v_owner uuid; v_plan text; v_trial timestamptz;
  v_oname text; v_ophone text;
begin
  select s.name, s.owner_id, s.plan::text, s.trial_ends_at
    into v_name, v_owner, v_plan, v_trial
    from public.stores s where s.id = p_store_id;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() then raise exception 'not_authorized'; end if;

  select p.full_name, p.phone into v_oname, v_ophone
    from public.profiles p where p.id = v_owner;

  insert into public.notifications (user_id, type, data)
  select p.id, 'pro_request',
         jsonb_build_object(
           'store_id', p_store_id,
           'store_name', v_name,
           'owner_name', nullif(trim(coalesce(v_oname, '')), ''),
           -- prefer the phone the owner typed on the request; fall back to their profile phone
           'phone', coalesce(
                      nullif(trim(coalesce(p_phone, '')), ''),
                      nullif(trim(coalesce(v_ophone, '')), '')),
           'plan', v_plan,
           'trial_ends_at', v_trial)
  from public.profiles p where p.role = 'super_admin';
end $function$;
