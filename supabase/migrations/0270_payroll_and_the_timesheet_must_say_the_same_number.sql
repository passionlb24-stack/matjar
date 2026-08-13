-- I gave the shop two different answers for the same day's work.
--
-- 0266 added breaks and 0267 made attendance_net_minutes subtract them, so the
-- attendance screen reports seven hours. build_payroll never learned: it still
-- computes checked_out - checked_in itself and pays eight. For an hourly worker
-- that difference is wages, and the owner has no way to tell which screen is
-- lying because both look definitive.
--
-- The divergence is mine, introduced today, and the fix is not to pick a better
-- formula but to stop having two. Payroll now calls the same function the
-- timesheet does.
--
-- That makes breaks unpaid, which is the ordinary arrangement for hourly work
-- and what the screen has been claiming since this morning. It is a decision
-- about wages, not a technical detail: a shop that pays through breaks should
-- not record them, and the break buttons can simply go unused — the arithmetic
-- then behaves exactly as it did before any of this.
--
-- Salaried and daily pay are untouched. A month is a month, and a day someone
-- turned up is a day, whatever the hours inside it.
create or replace function public.build_payroll(p_store_id uuid, p_from date, p_to date)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_run_id uuid;
  v_emp record;
  v_days integer;
  v_minutes integer;
  v_gross numeric(12, 2);
  v_adv numeric(12, 2);
  v_usd numeric(12, 2) := 0;
  v_lbp numeric(16, 2) := 0;
  v_months numeric;
begin
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'bad_period';
  end if;

  if exists (select 1 from public.payroll_runs
             where store_id = p_store_id and status = 'posted'
               and period_start = p_from and period_end = p_to) then
    raise exception 'period_already_posted';
  end if;

  delete from public.payroll_runs
  where store_id = p_store_id and status = 'draft'
    and period_start = p_from and period_end = p_to;

  insert into public.payroll_runs (store_id, period_start, period_end, created_by)
  values (p_store_id, p_from, p_to, auth.uid())
  returning id into v_run_id;

  v_months := (p_to - p_from + 1)::numeric / 30.0;

  -- A shift left open would otherwise count as zero minutes and pay nothing for
  -- the day. The guard closes it and marks it an estimate, which is at least
  -- visible and correctable.
  perform public.close_stale_attendance(p_store_id);

  for v_emp in
    select * from public.store_employees
    where store_id = p_store_id
      and (status = 'active' or (ended_on is not null and ended_on >= p_from))
    order by name
  loop
    select
      count(distinct a.work_date),
      -- The same function the timesheet reports from. One number, one truth.
      coalesce(sum(public.attendance_net_minutes(a)), 0)::integer
    into v_days, v_minutes
    from public.employee_attendance a
    where a.employee_id = v_emp.id
      and a.work_date between p_from and p_to;

    v_gross := case v_emp.pay_basis
      when 'monthly' then round(v_emp.pay_rate * v_months, 2)
      when 'daily'   then round(v_emp.pay_rate * coalesce(v_days, 0), 2)
      else                round(v_emp.pay_rate * coalesce(v_minutes, 0) / 60.0, 2)
    end;

    select coalesce(sum(amount), 0) into v_adv
    from public.employee_advances
    where employee_id = v_emp.id
      and currency = v_emp.pay_currency
      and given_on between p_from and p_to;

    insert into public.payroll_lines (
      run_id, employee_id, employee_name, pay_basis, pay_rate, currency,
      days_worked, minutes_worked, gross, advances, net
    ) values (
      v_run_id, v_emp.id, v_emp.name, v_emp.pay_basis, v_emp.pay_rate,
      v_emp.pay_currency, coalesce(v_days, 0), coalesce(v_minutes, 0),
      v_gross, v_adv, greatest(v_gross - v_adv, 0)
    );

    if v_emp.pay_currency = 'USD' then
      v_usd := v_usd + greatest(v_gross - v_adv, 0);
    else
      v_lbp := v_lbp + greatest(v_gross - v_adv, 0);
    end if;
  end loop;

  update public.payroll_runs
  set total_usd = v_usd, total_lbp = v_lbp
  where id = v_run_id;

  return v_run_id;
end
$function$;

-- Payroll selects on work_date; the timesheet derives the day from
-- checked_in_at. They agreed until corrections arrived, because work_date was
-- stamped once at insert and never moved again. Correcting a shift across
-- midnight would then pay it on one day and display it on another.
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
      work_date = (p_in at time zone 'Asia/Beirut')::date,
      auto_closed = false,
      edited_by = auth.uid(),
      edited_at = now(),
      edit_reason = btrim(p_reason)
  where id = p_id;

  update public.employee_breaks b
  set ended_at = p_out
  where b.attendance_id = p_id
    and b.ended_at is null
    and p_out is not null;
end
$function$;

revoke all on function public.correct_attendance(uuid, timestamptz, timestamptz, text)
  from public, anon;
