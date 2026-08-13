-- One button that guesses is not a time clock.
--
-- Today the punch is a toggle: whatever state the row is in, the tap flips it.
-- If a phone retries, or two taps land, or the person is not sure whether the
-- first one took, the system cheerfully records the opposite of what they meant
-- and there is no way to tell afterwards. Every real time clock asks for the
-- action and refuses it when it does not match the state, which is also the only
-- way the screen can say "تسجيل خروج" and mean it.
--
-- So the punch takes an action. Passing none keeps the old toggle, because the
-- deployed site still calls this with three arguments and I am not repeating
-- 0264 — the return keys are a superset of what it reads, and nothing it sends
-- changes meaning.

-- The 3-arg version has to go, or a 3-arg call keeps resolving to the OLD body
-- instead of the new default. Same signature otherwise, so callers are unaffected.
drop function if exists public.clock_by_device(text, numeric, numeric);

-- Minutes actually worked: time on the clock, less time on break. One place, so
-- payroll, the timesheet and the employee's own screen can never disagree.
create or replace function public.attendance_net_minutes(p_row public.employee_attendance)
returns integer
language sql
stable
set search_path to ''
as $function$
  select greatest(0, (
    extract(epoch from (
      coalesce(p_row.checked_out_at, now()) - p_row.checked_in_at
    )) / 60
    - coalesce((
      select sum(extract(epoch from (coalesce(b.ended_at, now()) - b.started_at)) / 60)
      from public.employee_breaks b
      where b.attendance_id = p_row.id
    ), 0)
  )::integer);
$function$;

-- Was this arrival late, given the shift the person is actually expected on?
-- Null — not false — when there is nothing to be late against. A shop that never
-- sets hours should see blanks, not a column of reassuring "on time".
create or replace function public.attendance_late_minutes(p_row public.employee_attendance)
returns integer
language sql
stable
set search_path to ''
as $function$
  select case
    when e.shift_start is null then null
    when e.work_days is not null
     and not (extract(isodow from (p_row.checked_in_at at time zone 'Asia/Beirut'))::smallint
              = any (e.work_days)) then null
    else greatest(0, (extract(epoch from (
           (p_row.checked_in_at at time zone 'Asia/Beirut')
           - ((p_row.checked_in_at at time zone 'Asia/Beirut')::date + e.shift_start)
         )) / 60 - s.late_grace_minutes)::integer)
  end
  from public.store_employees e
  join public.stores s on s.id = e.store_id
  where e.id = p_row.employee_id;
$function$;

-- The shift nobody closed.
--
-- Payroll reads coalesce(checked_out_at, checked_in_at), so an open row is zero
-- minutes and the worker is paid nothing for the day. Closing it at the shift
-- length is a guess, so it is marked as one: auto_closed stays true and the
-- screens say the end time is an estimate. A wrong number a human can see and
-- correct beats a zero nobody notices.
create or replace function public.close_stale_attendance(p_store_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  with stale as (
    update public.employee_attendance a
    set checked_out_at = a.checked_in_at + make_interval(hours => s.auto_close_hours),
        auto_closed = true
    from public.stores s
    where s.id = a.store_id
      and a.checked_out_at is null
      and (p_store_id is null or a.store_id = p_store_id)
      and a.checked_in_at < now() - make_interval(hours => s.auto_close_hours)
    returning a.id
  )
  select count(*) into v_count from stale;

  -- A break left open inside a closed shift would keep growing against `now()`
  -- forever and eat the whole day's minutes.
  update public.employee_breaks b
  set ended_at = a.checked_out_at
  from public.employee_attendance a
  where a.id = b.attendance_id
    and b.ended_at is null
    and a.checked_out_at is not null;

  return v_count;
end
$function$;

revoke all on function public.close_stale_attendance(uuid) from public, anon, authenticated;

-- What the person's own screen is allowed to know: their state, their hours, and
-- their last week. Keyed by the credential, so the phone proves who is asking by
-- the same biometric that punches — there is no account to log into.
create or replace function public.attendance_snapshot(p_employee_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with open_row as (
    select * from public.employee_attendance
    where employee_id = p_employee_id and checked_out_at is null
    order by checked_in_at desc limit 1
  ),
  open_break as (
    select b.* from public.employee_breaks b
    join open_row o on o.id = b.attendance_id
    where b.ended_at is null
    limit 1
  ),
  recent as (
    select a.*
    from public.employee_attendance a
    where a.employee_id = p_employee_id
      and a.checked_in_at > now() - interval '14 days'
    order by a.checked_in_at desc
    limit 14
  )
  select jsonb_build_object(
    'state', case
       when (select count(*) from open_break) > 0 then 'break'
       when (select count(*) from open_row) > 0 then 'in'
       else 'out' end,
    'since', (select checked_in_at from open_row),
    'break_since', (select started_at from open_break),
    'today_minutes', coalesce((
      select sum(public.attendance_net_minutes(a))
      from public.employee_attendance a
      where a.employee_id = p_employee_id
        and (a.checked_in_at at time zone 'Asia/Beirut')::date
            = (now() at time zone 'Asia/Beirut')::date
    ), 0),
    'week_minutes', coalesce((
      select sum(public.attendance_net_minutes(a))
      from public.employee_attendance a
      where a.employee_id = p_employee_id
        and (a.checked_in_at at time zone 'Asia/Beirut')::date
            >= date_trunc('week', (now() at time zone 'Asia/Beirut'))::date
    ), 0),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', (r.checked_in_at at time zone 'Asia/Beirut')::date,
        'in', r.checked_in_at,
        'out', r.checked_out_at,
        'minutes', public.attendance_net_minutes(r),
        'auto_closed', r.auto_closed,
        'edited', r.edited_at is not null,
        'late_minutes', public.attendance_late_minutes(r)
      ) order by r.checked_in_at desc)
      from recent r
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.attendance_snapshot(uuid) from public, anon, authenticated;

-- The punch itself.
create or replace function public.clock_by_device(
  p_credential_id text,
  p_lat numeric,
  p_lng numeric,
  p_action text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_dev public.employee_devices%rowtype;
  v_emp public.store_employees%rowtype;
  v_store public.stores%rowtype;
  v_open public.employee_attendance%rowtype;
  v_break public.employee_breaks%rowtype;
  v_dist numeric;
  v_act text;
  v_has_open boolean;
  v_has_break boolean;
begin
  select * into v_dev from public.employee_devices where credential_id = p_credential_id;
  if not found then raise exception 'device_not_registered'; end if;

  select * into v_emp from public.store_employees where id = v_dev.employee_id;
  if v_emp.status <> 'active' then raise exception 'employee_not_active'; end if;

  select * into v_store from public.stores where id = v_dev.store_id;

  if v_store.lat is null or v_store.lng is null then
    return jsonb_build_object('action', 'no_store_location');
  end if;
  if p_lat is null or p_lng is null then
    return jsonb_build_object('action', 'no_location');
  end if;

  v_dist := public.meters_between(v_store.lat, v_store.lng, p_lat, p_lng);
  if v_dist > v_store.clock_radius_m then
    return jsonb_build_object(
      'action', 'too_far',
      'meters', round(v_dist),
      'allowed', v_store.clock_radius_m
    );
  end if;

  -- Yesterday's forgotten shift must not become today's "you are already in".
  perform public.close_stale_attendance(v_dev.store_id);

  select * into v_open from public.employee_attendance
  where employee_id = v_emp.id and checked_out_at is null
  order by checked_in_at desc limit 1;
  v_has_open := found;

  v_break := null;
  v_has_break := false;
  if v_has_open then
    select * into v_break from public.employee_breaks
    where attendance_id = v_open.id and ended_at is null limit 1;
    v_has_break := found;
  end if;

  -- No action means the old toggle, which is what the deployed site still sends.
  v_act := coalesce(nullif(btrim(p_action), ''),
                    case when v_has_open then 'out' else 'in' end);

  -- The point of asking: refuse when the request does not match reality, instead
  -- of doing the opposite and calling it success.
  if v_act = 'in' and v_has_open then
    return jsonb_build_object('action', 'already_in', 'name', v_emp.name,
                              'since', v_open.checked_in_at);
  end if;
  if v_act in ('out', 'break_start', 'break_end') and not v_has_open then
    return jsonb_build_object('action', 'not_in', 'name', v_emp.name);
  end if;
  if v_act = 'break_start' and v_has_break then
    return jsonb_build_object('action', 'already_break', 'name', v_emp.name,
                              'break_since', v_break.started_at);
  end if;
  if v_act = 'break_end' and not v_has_break then
    return jsonb_build_object('action', 'not_break', 'name', v_emp.name);
  end if;
  if v_act not in ('in', 'out', 'break_start', 'break_end') then
    raise exception 'unknown_action';
  end if;

  update public.employee_devices set last_used_at = now() where id = v_dev.id;

  if v_act = 'break_start' then
    insert into public.employee_breaks (attendance_id, source)
    values (v_open.id, 'device');
  elsif v_act = 'break_end' then
    update public.employee_breaks set ended_at = now() where id = v_break.id;
  elsif v_act = 'out' then
    -- Leaving while on break closes the break at the same instant, rather than
    -- leaving one running inside a finished shift and eating the day's minutes.
    if v_has_break then
      update public.employee_breaks set ended_at = now() where id = v_break.id;
    end if;
    update public.employee_attendance
    set checked_out_at = now(),
        out_lat = p_lat,
        out_lng = p_lng,
        out_meters = round(v_dist)
    where id = v_open.id;
  else
    insert into public.employee_attendance
      (store_id, employee_id, work_date, source, lat, lng, in_meters)
    values (v_dev.store_id, v_emp.id,
            (now() at time zone 'Asia/Beirut')::date, 'device',
            p_lat, p_lng, round(v_dist));
  end if;

  -- `action`, `name` and `meters` are exactly what the deployed client reads.
  -- Everything after them is additive.
  return jsonb_build_object('action', v_act, 'name', v_emp.name,
                            'meters', round(v_dist), 'at', now())
         || public.attendance_snapshot(v_emp.id);
end
$function$;

revoke all on function public.clock_by_device(text, numeric, numeric, text)
  from public, anon, authenticated;

-- Correcting a shift, with the original left where it was.
create or replace function public.correct_attendance(
  p_id uuid,
  p_in timestamptz,
  p_out timestamptz,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.employee_attendance%rowtype;
begin
  select * into v_row from public.employee_attendance where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not (public.can_manage_store(v_row.store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'reason_required';
  end if;
  if p_out is not null and p_out <= p_in then
    raise exception 'out_before_in';
  end if;

  update public.employee_attendance
  set original_checked_in_at = coalesce(original_checked_in_at, checked_in_at),
      original_checked_out_at = coalesce(original_checked_out_at, checked_out_at),
      checked_in_at = p_in,
      checked_out_at = p_out,
      -- A hand-corrected end time is no longer the guard's estimate.
      auto_closed = case when p_out is not null then false else auto_closed end,
      edited_by = auth.uid(),
      edited_at = now(),
      edit_reason = btrim(p_reason)
  where id = p_id;
end
$function$;

revoke all on function public.correct_attendance(uuid, timestamptz, timestamptz, text)
  from public, anon;

-- The sheet the shop reads.
create or replace function public.attendance_timesheet(
  p_store_id uuid,
  p_from date,
  p_to date
)
returns table (
  id uuid,
  employee_id uuid,
  employee_name text,
  work_date date,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  net_minutes integer,
  break_minutes integer,
  late_minutes integer,
  source text,
  in_meters integer,
  out_meters integer,
  auto_closed boolean,
  edited boolean,
  edit_reason text
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  -- Read the sheet, and yesterday's forgotten shift is already closed by the
  -- time it is read, rather than sitting at zero until someone notices.
  perform public.close_stale_attendance(p_store_id);

  return query
  select a.id,
         a.employee_id,
         e.name,
         (a.checked_in_at at time zone 'Asia/Beirut')::date,
         a.checked_in_at,
         a.checked_out_at,
         public.attendance_net_minutes(a),
         coalesce((
           select sum(extract(epoch from (coalesce(b.ended_at, now()) - b.started_at)) / 60)
           from public.employee_breaks b where b.attendance_id = a.id
         ), 0)::integer,
         public.attendance_late_minutes(a),
         a.source,
         a.in_meters,
         a.out_meters,
         a.auto_closed,
         a.edited_at is not null,
         a.edit_reason
  from public.employee_attendance a
  join public.store_employees e on e.id = a.employee_id
  where a.store_id = p_store_id
    and (a.checked_in_at at time zone 'Asia/Beirut')::date between p_from and p_to
  order by a.checked_in_at desc;
end
$function$;

revoke all on function public.attendance_timesheet(uuid, date, date)
  from public, anon;

-- Dropping and recreating leaves PostgREST holding the old signature.
notify pgrst, 'reload schema';
