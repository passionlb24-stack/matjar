-- I built fingerprints to stop buddy-punching and left buddy-punching running
-- next to them.
--
-- The PIN kiosk was still on the tablet: tap a name, type four digits everyone
-- in the shop knows, done. Every argument I made for the device flow — that a
-- shared secret cannot attribute a punch to a person — applies unchanged to the
-- path I left open beside it. Two doors, one of them the one I had just called
-- unfixable.
--
-- So the PIN goes. What remains is two honest routes and no third:
--
--   the person proves it with their own phone's biometric, at the shop, or
--   the manager records it and the row says 'manager' rather than their name.
--
-- The manager route already covers the old-phone fallback the kiosk was meant
-- to serve, and covers it truthfully.
--
-- pin_hash is dropped rather than left dormant: a column holding live
-- credentials for a retired auth path is exactly the thing someone re-enables in
-- two years without re-reading why it was turned off.
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
begin
  -- Managers only, and recorded as such. The PIN argument is kept in the
  -- signature so any stale caller fails loudly instead of silently punching.
  if p_pin is not null and btrim(p_pin) <> '' then
    raise exception 'pin_clock_retired';
  end if;
  if not (public.can_manage_store(p_store_id) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  select * into v_emp from public.store_employees
  where id = p_employee_id and store_id = p_store_id;
  if not found then raise exception 'employee_not_found'; end if;
  if v_emp.status <> 'active' then raise exception 'employee_not_active'; end if;

  select * into v_open from public.employee_attendance
  where employee_id = p_employee_id and checked_out_at is null;

  if found then
    update public.employee_attendance
    set checked_out_at = now()
    where id = v_open.id;
    return jsonb_build_object('action', 'out');
  end if;

  insert into public.employee_attendance
    (store_id, employee_id, work_date, source, lat, lng)
  values (p_store_id, p_employee_id,
          (now() at time zone 'Asia/Beirut')::date, 'manager', p_lat, p_lng);
  return jsonb_build_object('action', 'in');
end
$function$;

drop function if exists public.set_employee_pin(uuid, text);
drop function if exists public.store_employee_roster(uuid);
drop table if exists public.clock_attempts;
alter table public.store_employees drop column if exists pin_hash;

-- 'pin' stays in the allowed sources so the handful of test rows written that
-- way remain readable; nothing can write it any more.
comment on column public.employee_attendance.source is
  'device = the person''s own phone, verified by biometric and location. manager = recorded by whoever runs the shop. pin = retired path, historical rows only.';
