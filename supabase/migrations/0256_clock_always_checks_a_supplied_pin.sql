-- A PIN that is only checked when the caller is a stranger is not a PIN.
--
-- The shared tablet on the counter is signed in as the shop. Under the first
-- version that made every punch from it a manager punch, so the PIN box on
-- screen was decoration: anyone could tap a name and be clocked in as that
-- person. The whole point of asking is attribution.
--
-- So: a PIN supplied is a PIN verified, whoever is calling. No PIN at all stays
-- available to whoever manages the store, because a manager writing down that
-- someone came in at seven is a real and necessary thing — it is just recorded
-- as 'manager', not as the person.
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
begin
  select * into v_emp from public.store_employees
  where id = p_employee_id and store_id = p_store_id;
  if not found then raise exception 'employee_not_found'; end if;
  if v_emp.status <> 'active' then raise exception 'employee_not_active'; end if;

  if p_pin is not null and btrim(p_pin) <> '' then
    if v_emp.pin_hash is null
       or v_emp.pin_hash <> extensions.crypt(p_pin, v_emp.pin_hash) then
      raise exception 'bad_pin';
    end if;
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

-- The kiosk needs to show who works here before anyone can tap a name, and RLS
-- correctly refuses that to someone who is not managing the store. Names and ids
-- only — never the PIN hash, the pay rate, or the papers.
create or replace function public.store_employee_roster(p_store_id uuid)
returns table (id uuid, name text, job_title text, on_shift boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  select e.id, e.name, e.job_title,
         exists (select 1 from public.employee_attendance a
                 where a.employee_id = e.id and a.checked_out_at is null)
  from public.store_employees e
  where e.store_id = p_store_id
    and e.status = 'active'
    and e.pin_hash is not null
  order by e.name;
$function$;

revoke all on function public.store_employee_roster(uuid) from public;
grant execute on function public.store_employee_roster(uuid) to authenticated;
