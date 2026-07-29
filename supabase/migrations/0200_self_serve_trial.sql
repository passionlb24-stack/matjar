-- 0200: Self-serve 14-day Pro trial. New stores already auto-get a trial (0112),
-- but stores created before that (trial_ends_at is null) had no way to start one
-- and had to wait on an admin. This lets the owner activate their own trial
-- instantly — it starts counting the 14 days immediately; the admin only gets
-- involved at payment time when the trial ends. One trial per store (a non-null
-- trial_ends_at, active or expired, blocks re-activation).
create or replace function public.start_pro_trial(p_store_id uuid)
returns timestamptz language plpgsql security definer set search_path to '' as $function$
declare v_owner uuid; v_plan text; v_trial timestamptz; v_ends timestamptz;
begin
  select owner_id, plan::text, trial_ends_at into v_owner, v_plan, v_trial
    from public.stores where id = p_store_id;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() then raise exception 'not_authorized'; end if;
  if v_plan = 'pro' then raise exception 'already_pro'; end if;
  if v_trial is not null then raise exception 'trial_used'; end if;
  v_ends := now() + interval '14 days';
  update public.stores set trial_ends_at = v_ends, updated_at = now() where id = p_store_id;
  return v_ends;
end $function$;
revoke execute on function public.start_pro_trial(uuid) from anon;
grant execute on function public.start_pro_trial(uuid) to authenticated;
