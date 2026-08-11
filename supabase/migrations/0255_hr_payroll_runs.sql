-- Payroll: attendance and rates turned into what each person is owed.
--
-- Two steps on purpose. A draft is calculated and can be looked at, corrected
-- and recalculated; posting is the act that puts the number in the books and
-- cannot be undone by recalculating. Merging them would mean every glance at
-- payroll wrote an expense.
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'posted')),
  total_usd numeric(12, 2) not null default 0,
  total_lbp numeric(16, 2) not null default 0,
  expense_id uuid references public.store_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  posted_at timestamptz,
  posted_by uuid references public.profiles(id) on delete set null,
  constraint payroll_runs_period check (period_end >= period_start)
);

create index if not exists payroll_runs_store_idx
  on public.payroll_runs (store_id, period_end desc);

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.store_employees(id) on delete restrict,
  employee_name text not null,
  pay_basis text not null,
  pay_rate numeric(12, 2) not null,
  currency text not null,
  days_worked integer not null default 0,
  minutes_worked integer not null default 0,
  gross numeric(12, 2) not null default 0,
  advances numeric(12, 2) not null default 0,
  net numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id)
);

alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;

drop policy if exists payroll_runs_all on public.payroll_runs;
create policy payroll_runs_all on public.payroll_runs
  for all using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());

drop policy if exists payroll_lines_read on public.payroll_lines;
create policy payroll_lines_read on public.payroll_lines
  for select using (exists (
    select 1 from public.payroll_runs r
    where r.id = payroll_lines.run_id
      and (public.can_manage_store(r.store_id) or public.is_super_admin())
  ));

-- Lines are computed, never typed, so there is no insert policy: they come from
-- the function below and nowhere else.

create or replace function public.build_payroll(
  p_store_id uuid,
  p_from date,
  p_to date
)
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

  -- Recalculating a posted run would rewrite what was already put in the books.
  if exists (select 1 from public.payroll_runs
             where store_id = p_store_id and status = 'posted'
               and period_start = p_from and period_end = p_to) then
    raise exception 'period_already_posted';
  end if;

  -- A draft for the same period is replaced, so pressing calculate twice is
  -- harmless rather than producing two competing sheets.
  delete from public.payroll_runs
  where store_id = p_store_id and status = 'draft'
    and period_start = p_from and period_end = p_to;

  insert into public.payroll_runs (store_id, period_start, period_end, created_by)
  values (p_store_id, p_from, p_to, auth.uid())
  returning id into v_run_id;

  -- A month is the period length over 30, so a half-month run pays half a
  -- monthly salary instead of a full one.
  v_months := (p_to - p_from + 1)::numeric / 30.0;

  for v_emp in
    select * from public.store_employees
    where store_id = p_store_id
      and (status = 'active' or (ended_on is not null and ended_on >= p_from))
    order by name
  loop
    select
      count(distinct work_date),
      coalesce(sum(
        extract(epoch from (coalesce(checked_out_at, checked_in_at) - checked_in_at)) / 60
      ), 0)::integer
    into v_days, v_minutes
    from public.employee_attendance
    where employee_id = v_emp.id
      and work_date between p_from and p_to;

    v_gross := case v_emp.pay_basis
      -- A salary is a salary: it does not shrink because someone took a day.
      -- Absence is handled by a deduction the owner decides on, not by silent
      -- arithmetic they never agreed to.
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

-- Posting writes the wage bill into the same expenses ledger everything else
-- uses, so payroll shows up in profit and in the period lock like any other
-- cost. One row, dated the end of the period.
create or replace function public.post_payroll(p_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_run public.payroll_runs%rowtype;
  v_expense_id uuid;
begin
  select * into v_run from public.payroll_runs where id = p_run_id;
  if not found then raise exception 'run_not_found'; end if;
  if not (public.can_manage_store(v_run.store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;
  if v_run.status = 'posted' then
    return v_run.expense_id;
  end if;

  -- Only the USD side becomes an expense line: store_expenses carries a single
  -- amount with no currency, and silently adding lira to dollars would produce
  -- a number that is wrong in a way nobody would catch. The lira total stays on
  -- the run, visible, until expenses learn about currency.
  if v_run.total_usd > 0 then
    insert into public.store_expenses (store_id, label, amount, category, spent_on)
    values (
      v_run.store_id,
      'رواتب ' || to_char(v_run.period_start, 'YYYY-MM-DD') || ' → ' ||
                  to_char(v_run.period_end, 'YYYY-MM-DD'),
      v_run.total_usd, 'salaries', v_run.period_end
    )
    returning id into v_expense_id;
  end if;

  update public.payroll_runs
  set status = 'posted', posted_at = now(), posted_by = auth.uid(),
      expense_id = v_expense_id
  where id = p_run_id;

  return v_expense_id;
end
$function$;

revoke all on function public.build_payroll(uuid, date, date) from public;
grant execute on function public.build_payroll(uuid, date, date) to authenticated;
revoke all on function public.post_payroll(uuid) from public;
grant execute on function public.post_payroll(uuid) to authenticated;
