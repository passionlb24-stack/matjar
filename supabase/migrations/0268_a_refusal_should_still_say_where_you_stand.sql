-- A refusal told the screen "no" and nothing else.
--
-- 0267 merged the snapshot into a successful punch and forgot to merge it into
-- the four refusals — already_in, not_in, already_break, not_break. Those are
-- precisely the moments when the screen and the database disagree about what is
-- happening, so they are the worst possible moment to withhold the answer. The
-- client had to reconstruct a state from the name of the refusal and keep the
-- old hours, which works and should not have been necessary.
--
-- All four run after the stale-shift guard, so the snapshot they carry is the
-- post-guard truth. The location refusals (too_far, no_location,
-- no_store_location) are deliberately left alone: they return before the guard,
-- so a snapshot there could still describe yesterday's forgotten shift, and a
-- stale answer is worse than none.
--
-- Additive, as 0264 taught: every key a caller already reads keeps its meaning.

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
    -- The greeting could not render until the first punch, because only a punch
    -- carried a name. Asking "where do I stand" should be able to say whose
    -- standing it is.
    'name', (select name from public.store_employees where id = p_employee_id),
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

  v_act := coalesce(nullif(btrim(p_action), ''),
                    case when v_has_open then 'out' else 'in' end);

  -- Each refusal now carries the same snapshot a punch does, so the screen can
  -- correct itself from the answer instead of inferring a state from the word.
  if v_act = 'in' and v_has_open then
    return jsonb_build_object('action', 'already_in', 'name', v_emp.name,
                              'since', v_open.checked_in_at)
           || public.attendance_snapshot(v_emp.id);
  end if;
  if v_act in ('out', 'break_start', 'break_end') and not v_has_open then
    return jsonb_build_object('action', 'not_in', 'name', v_emp.name)
           || public.attendance_snapshot(v_emp.id);
  end if;
  if v_act = 'break_start' and v_has_break then
    return jsonb_build_object('action', 'already_break', 'name', v_emp.name,
                              'break_since', v_break.started_at)
           || public.attendance_snapshot(v_emp.id);
  end if;
  if v_act = 'break_end' and not v_has_break then
    return jsonb_build_object('action', 'not_break', 'name', v_emp.name)
           || public.attendance_snapshot(v_emp.id);
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

  -- The snapshot goes last so its `name` cannot be overwritten by a null.
  return jsonb_build_object('action', v_act, 'name', v_emp.name,
                            'meters', round(v_dist), 'at', now())
         || public.attendance_snapshot(v_emp.id);
end
$function$;

revoke all on function public.clock_by_device(text, numeric, numeric, text)
  from public, anon, authenticated;
