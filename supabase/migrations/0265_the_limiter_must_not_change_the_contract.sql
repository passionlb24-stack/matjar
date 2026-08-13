-- 0264 broke enrolment in production, and the way it broke is the lesson.
--
-- I changed redeem_enrolment_code's return type from uuid to jsonb and applied
-- it to the live database while the deployed application still called the uuid
-- version — the matching code was sitting on an unmerged branch. The running
-- site asked in the old contract, the database answered in the new one, and an
-- employee standing inside the geofence with a valid code was told the code was
-- wrong. enrolment_attempts is the proof: zero rows. Nothing ever reached the
-- limiter, because the call failed before it.
--
-- A schema change that requires a matching deploy to land first is a change with
-- an ordering requirement, and I gave it none. So the fix is not "deploy in the
-- right order next time" — it is to stop needing an order at all.
--
-- The signature goes back to what production calls and stays there:
--
--   redeem_enrolment_code(uuid, text) -> uuid    null means "no".
--
-- The rate limit survives, because returning null instead of raising was always
-- the part that mattered (0259): the insert recording the failure commits, so
-- the counter actually counts. What null cannot carry is WHY, so the reason
-- moves to a separate function that old callers simply never ask. Additive, not
-- breaking — the old route works unchanged, and the new one gets the better
-- message when it ships.

drop function if exists public.redeem_enrolment_code(uuid, text);

create function public.redeem_enrolment_code(p_store_id uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_emp uuid;
  v_bad integer;
begin
  select count(*) into v_bad
  from public.enrolment_attempts
  where store_id = p_store_id
    and not ok
    and at > now() - interval '15 minutes';

  -- Locked: refuse without logging. Counting a guess that was never looked at
  -- would let a locked shop extend its own lockout indefinitely.
  if v_bad >= 5 then
    return null;
  end if;

  select id, employee_id into v_id, v_emp
  from public.employee_enrolments
  where store_id = p_store_id
    and code = btrim(p_code)
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  -- Never `raise` here. A raise rolls back the insert below with everything else
  -- in the function, which is exactly how the PIN limiter in 0258 came to count
  -- nothing at all.
  if v_id is null then
    insert into public.enrolment_attempts (store_id, employee_id, ok)
    values (p_store_id, null, false);
    return null;
  end if;

  update public.employee_enrolments set used_at = now() where id = v_id;

  insert into public.enrolment_attempts (store_id, employee_id, ok)
  values (p_store_id, v_emp, true);

  return v_emp;
end
$function$;

revoke all on function public.redeem_enrolment_code(uuid, text)
  from public, anon, authenticated;

-- Why the last answer was no. Asked only after a refusal, and only so the
-- employee is told "wait fifteen minutes" instead of "wrong code" while holding
-- the correct one — which is an instruction to keep trying.
create or replace function public.enrolment_locked(p_store_id uuid)
returns boolean
language sql
security definer
set search_path to ''
as $function$
  select count(*) >= 5
  from public.enrolment_attempts
  where store_id = p_store_id
    and not ok
    and at > now() - interval '15 minutes';
$function$;

revoke all on function public.enrolment_locked(uuid)
  from public, anon, authenticated;

-- Dropping and recreating a function leaves PostgREST holding the old signature
-- until it is told otherwise. That stale cache is the most likely reason the
-- live call failed outright rather than merely mismatching.
notify pgrst, 'reload schema';
