-- The rate limit I added in 0258 counted nothing.
--
-- It wrote the failed attempt and then raised 'bad_pin' — and the raise rolled
-- the write back with everything else in the function. Five wrong guesses left
-- zero rows behind, so the counter never moved and the correct PIN sailed
-- through afterwards. A limiter whose evidence is destroyed by the same event it
-- is meant to record is worse than none: it reads as protection.
--
-- Postgres has no autonomous transaction to escape this, so the fix is to stop
-- raising. A wrong PIN is now a returned outcome rather than an error, the
-- insert commits with the rest, and the caller reads the action.
create or replace function public.employee_clock(
  p_store_id uuid,
  p_employee_id uuid,
  p_pin text default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_emp public.store_employees%rowtype;
  v_open public.employee_attendance%rowtype;
  v_source text;
  v_bad integer;
begin
  select * into v_emp from public.store_employees
  where id = p_employee_id and store_id = p_store_id;
  if not found then raise exception 'employee_not_found'; end if;
  if v_emp.status <> 'active' then raise exception 'employee_not_active'; end if;

  if p_pin is not null and btrim(p_pin) <> '' then
    select count(*) into v_bad from public.clock_attempts
    where store_id = p_store_id and not ok and at > now() - interval '10 minutes';
    if v_bad >= 5 then
      return jsonb_build_object('action', 'locked');
    end if;

    if v_emp.pin_hash is null
       or v_emp.pin_hash <> extensions.crypt(p_pin, v_emp.pin_hash) then
      insert into public.clock_attempts (store_id, employee_id, ok, actor)
      values (p_store_id, p_employee_id, false, auth.uid());
      return jsonb_build_object('action', 'bad_pin');
    end if;

    insert into public.clock_attempts (store_id, employee_id, ok, actor)
    values (p_store_id, p_employee_id, true, auth.uid());
    v_source := 'pin';
  elsif public.can_manage_store(p_store_id) or public.is_super_admin() then
    v_source := 'manager';
  else
    raise exception 'not_authorized';
  end if;

  select * into v_open from public.employee_attendance
  where employee_id = p_employee_id and checked_out_at is null;

  if found then
    update public.employee_attendance
    set checked_out_at = now()
    where id = v_open.id;
    return jsonb_build_object('action', 'out', 'at', now());
  end if;

  insert into public.employee_attendance
    (store_id, employee_id, work_date, source, lat, lng)
  values (
    p_store_id, p_employee_id,
    (now() at time zone 'Asia/Beirut')::date,
    v_source, p_lat, p_lng
  );
  return jsonb_build_object('action', 'in', 'at', now());
end
$function$;

revoke all on function public.employee_clock(uuid, uuid, text, numeric, numeric) from public, anon;
grant execute on function public.employee_clock(uuid, uuid, text, numeric, numeric) to authenticated;
