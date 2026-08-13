-- Attendance today records that something happened. It does not record what.
--
-- A row has a check-in time, a check-out time, and where the check-IN was. That
-- is enough to say "someone was here" and not enough to answer any question a
-- shop actually asks: was she late, did she take her break, why does Tuesday say
-- four hours, who changed it, and — the one that costs money — what happens to
-- the shift nobody closed.
--
-- That last one is live right now. Payroll computes
-- `coalesce(checked_out_at, checked_in_at) - checked_in_at`, so an open shift is
-- zero minutes. A worker who forgets to tap on the way out is paid nothing for
-- the day, silently, and the only trace is a row that looks fine. There is an
-- open shift in the data as I write this.
--
-- So: evidence on both ends of the punch, breaks as their own events, an
-- expected shift to be late against, and corrections that leave the original
-- intact and say who changed it and why.

-- ---------------------------------------------------------------- the punch --
alter table public.employee_attendance
  -- Where the person was when they LEFT, not only when they arrived. Half the
  -- evidence was being thrown away.
  add column if not exists out_lat numeric(10, 6),
  add column if not exists out_lng numeric(10, 6),
  -- Distance is computed at punch time against the shop pin as it was then.
  -- Recomputing it later from the stored pin would silently rewrite history
  -- every time the owner nudges the marker on the map.
  add column if not exists in_meters integer,
  add column if not exists out_meters integer,
  -- Closed by the guard below rather than by a person. Kept visible instead of
  -- tidied away: a day that ended because a timer said so is not a day someone
  -- clocked out of, and payroll should not pretend otherwise.
  add column if not exists auto_closed boolean not null default false,
  -- A correction never overwrites what the device recorded. The original stays,
  -- and the row says who moved it and why.
  add column if not exists original_checked_in_at timestamptz,
  add column if not exists original_checked_out_at timestamptz,
  add column if not exists edited_by uuid,
  add column if not exists edited_at timestamptz,
  add column if not exists edit_reason text;

comment on column public.employee_attendance.auto_closed is
  'true = nobody clocked out; the shift was closed by the stale-shift guard. Treat the end time as an estimate, not a fact.';

-- --------------------------------------------------------------- the breaks --
-- Their own events, not a break_minutes integer on the shift. A single number
-- cannot answer "when did she go" and cannot be corrected without guessing what
-- it was made of. Minutes are derived from these rows wherever they are needed,
-- so there is one truth and not two that drift.
create table if not exists public.employee_breaks (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null
    references public.employee_attendance(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'device' check (source in ('device', 'manager')),
  created_at timestamptz not null default now()
);

create index if not exists employee_breaks_attendance_idx
  on public.employee_breaks (attendance_id, started_at desc);

-- One break open at a time per shift. Enforced here rather than in the function,
-- because two taps racing each other is exactly the case a check in application
-- code loses.
create unique index if not exists employee_breaks_one_open_idx
  on public.employee_breaks (attendance_id)
  where ended_at is null;

alter table public.employee_breaks enable row level security;

-- Readable by whoever runs the shop; written only through the SECURITY DEFINER
-- functions, so an employee's phone can never post a break for someone else.
drop policy if exists employee_breaks_read on public.employee_breaks;
create policy employee_breaks_read on public.employee_breaks
  for select using (
    exists (
      select 1
      from public.employee_attendance a
      where a.id = employee_breaks.attendance_id
        and (public.can_manage_store(a.store_id) or public.is_super_admin())
    )
  );

-- ------------------------------------------------------------ the shift plan --
-- Optional on purpose. Null means "no expected hours", and a shop that never
-- fills this in gets exactly what it has today, with nothing marked late. 0257
-- dropped an unused `schedule` column; this one arrives with the screens that
-- set it, or it should not arrive at all.
alter table public.store_employees
  add column if not exists shift_start time,
  add column if not exists shift_end time,
  -- ISO days, 1 = Monday .. 7 = Sunday. Null means every day the person shows up
  -- counts, which is how most small shops actually run.
  add column if not exists work_days smallint[];

alter table public.stores
  -- Nobody is late by ninety seconds. A shop with no grace period turns a clock
  -- into a weapon, and the first thing it teaches staff is to game it.
  add column if not exists late_grace_minutes integer not null default 10,
  -- After this, an open shift is assumed forgotten rather than heroic.
  add column if not exists auto_close_hours integer not null default 16;

alter table public.stores
  drop constraint if exists stores_auto_close_hours_sane;
alter table public.stores
  add constraint stores_auto_close_hours_sane
  check (auto_close_hours between 4 and 24);
