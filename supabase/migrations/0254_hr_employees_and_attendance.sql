create extension if not exists pgcrypto with schema extensions;

-- An employee is a record, not a login.
--
-- store_staff already exists and is the wrong thing for this: it needs an email
-- and a platform account, because it grants dashboard access. A butcher with six
-- workers — a driver, a cleaner, two behind the counter — is not going to create
-- six Matjar accounts, and shouldn't have to in order to be on the payroll.
-- user_id is here for the ones who do have an account, and is null for everyone
-- else.
create table if not exists public.store_employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  job_title text,
  -- How they are paid, which decides how attendance turns into money.
  pay_basis text not null default 'monthly'
    check (pay_basis in ('monthly', 'daily', 'hourly')),
  pay_rate numeric(12, 2) not null default 0 check (pay_rate >= 0),
  -- Lebanese payroll is genuinely bi-currency; a salary is quoted in one or the
  -- other and the two are not interchangeable at a fixed rate.
  pay_currency text not null default 'USD' check (pay_currency in ('USD', 'LBP')),
  -- Weekly schedule, same shape as stores.hours: weekday key -> {open, close}.
  -- Null means no fixed schedule (day labour), which payroll handles differently.
  schedule jsonb,
  -- Papers. Residency expiry matters here in a way it does not in most payroll
  -- systems: a large share of shop staff are on permits that lapse.
  id_number text,
  residency_expires_on date,
  started_on date,
  ended_on date,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  -- Hashed, never stored in the clear. Used to clock in from a shared device.
  pin_hash text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_employees_store_idx
  on public.store_employees (store_id, status, name);

-- One row per shift worked, not per day: shops here close at midday and reopen,
-- and a split shift is two spans, not one long one.
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_id uuid not null references public.store_employees(id) on delete cascade,
  work_date date not null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  -- Where the record came from, because "the manager typed it" and "the person
  -- stood here and entered their PIN" are different levels of evidence.
  source text not null default 'manager'
    check (source in ('manager', 'pin', 'device')),
  lat numeric(10, 6),
  lng numeric(10, 6),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists employee_attendance_emp_idx
  on public.employee_attendance (employee_id, work_date desc);
create index if not exists employee_attendance_store_idx
  on public.employee_attendance (store_id, work_date desc);
-- At most one open shift per person: clocking in twice is a mistake, not a fact.
create unique index if not exists employee_attendance_open_idx
  on public.employee_attendance (employee_id) where checked_out_at is null;

-- سلفة. Money handed over mid-month, deducted at payroll. Every small shop in
-- Lebanon runs on these and none of them are written down anywhere.
create table if not exists public.employee_advances (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_id uuid not null references public.store_employees(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'LBP')),
  given_on date not null default (now() at time zone 'Asia/Beirut')::date,
  note text,
  settled_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists employee_advances_emp_idx
  on public.employee_advances (employee_id, given_on desc);

alter table public.store_employees enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.employee_advances enable row level security;

-- Staff management is an owner-level concern; the existing per-module staff
-- permissions do not include "may see everyone's salary", so this stays with
-- whoever can manage the store.
drop policy if exists store_employees_all on public.store_employees;
create policy store_employees_all on public.store_employees
  for all using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());

drop policy if exists employee_attendance_all on public.employee_attendance;
create policy employee_attendance_all on public.employee_attendance
  for all using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());

drop policy if exists employee_advances_all on public.employee_advances;
create policy employee_advances_all on public.employee_advances
  for all using (public.can_manage_store(store_id) or public.is_super_admin())
  with check (public.can_manage_store(store_id) or public.is_super_admin());

-- Setting a PIN goes through here so the clear value never reaches a column.
create or replace function public.set_employee_pin(
  p_employee_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_store uuid;
begin
  select store_id into v_store from public.store_employees where id = p_employee_id;
  if v_store is null then raise exception 'employee_not_found'; end if;
  if not (public.can_manage_store(v_store) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  if p_pin is null or btrim(p_pin) = '' then
    update public.store_employees set pin_hash = null, updated_at = now()
    where id = p_employee_id;
    return;
  end if;

  -- Four digits is what people will actually remember and type on a shared
  -- tablet; six would be ignored in favour of writing it on the wall.
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'bad_pin';
  end if;

  update public.store_employees
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_employee_id;
end
$function$;

-- Clock in, or out if a shift is already open. One button, because a person
-- arriving at 6am should not have to decide which button they are.
--
-- NOTE: superseded immediately by 0256, which fixes the hole where a punch from
-- the shop's own tablet skipped the PIN entirely.
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
  v_manager boolean;
  v_source text;
begin
  select * into v_emp from public.store_employees
  where id = p_employee_id and store_id = p_store_id;
  if not found then raise exception 'employee_not_found'; end if;
  if v_emp.status <> 'active' then raise exception 'employee_not_active'; end if;

  v_manager := public.can_manage_store(p_store_id) or public.is_super_admin();

  if v_manager then
    v_source := 'manager';
  elsif v_emp.pin_hash is not null
        and p_pin is not null
        and v_emp.pin_hash = extensions.crypt(p_pin, v_emp.pin_hash) then
    v_source := 'pin';
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

revoke all on function public.set_employee_pin(uuid, text) from public;
grant execute on function public.set_employee_pin(uuid, text) to authenticated;
revoke all on function public.employee_clock(uuid, uuid, text, numeric, numeric) from public;
grant execute on function public.employee_clock(uuid, uuid, text, numeric, numeric) to authenticated;
