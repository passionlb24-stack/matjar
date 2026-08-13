-- The stale-shift guard was undoing the owner's own decision.
--
-- Reopening a shift is a real thing to want: someone forgot to clock out, they
-- are still here, and the correct record is an open one. But the guard closes
-- anything older than the store's auto_close_hours, and attendance_timesheet
-- runs it on every read. So the owner reopened the shift, the screen reloaded,
-- and the row came back closed and stamped "estimate" — with no hint that
-- anything had overruled them. Found by reopening a row and then simply reading
-- the sheet.
--
-- The rule the guard was missing: it exists to rescue shifts nobody attended to.
-- Once a person has attended to one, guessing on their behalf is not a rescue.
-- So a corrected row is left alone. It stays visible as an open shift on the
-- live board either way, which is where a human should notice it — not by
-- having their edit quietly reverted.
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
      -- A human already ruled on this row. Their judgement outranks the timer.
      and a.edited_at is null
    returning a.id
  )
  select count(*) into v_count from stale;

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

-- And a corrected row is never the guard's guess, in either direction. Reopening
-- one used to leave auto_closed true, so an OPEN shift went on describing itself
-- as a closed estimate.
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
      auto_closed = false,
      edited_by = auth.uid(),
      edited_at = now(),
      edit_reason = btrim(p_reason)
  where id = p_id;

  -- A break cannot outlive the shift it belongs to, however the shift was moved.
  update public.employee_breaks b
  set ended_at = p_out
  where b.attendance_id = p_id
    and b.ended_at is null
    and p_out is not null;
end
$function$;

revoke all on function public.correct_attendance(uuid, timestamptz, timestamptz, text)
  from public, anon;
