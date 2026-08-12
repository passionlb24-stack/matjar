-- Three things wrong with the clock-in I shipped, all of them fatal in practice.
--
-- 1. An employee could not reach it. The kiosk lives under /merchant/<uuid>/…
--    and redirects to login, and an employee has no Matjar account. So the only
--    device it ever worked on was the owner's — which is not "the employee
--    clocks in", it is the owner typing attendance, which is what the notebook
--    already did.
--
-- 2. The PIN cannot tell people apart. Everyone knows everyone's four digits in
--    a six-person shop; "punch me in, I'm stuck in traffic" is the single most
--    common form of attendance fraud there is, and a shared secret cannot
--    prevent it by construction.
--
-- 3. Location was decoration. I recorded coordinates when the browser offered
--    them and shrugged when it did not, so clocking in from home worked exactly
--    as well as clocking in from the shop.
--
-- What follows binds a punch to a specific phone's biometric and to being
-- physically at the shop. I was also wrong earlier when I said a browser cannot
-- do fingerprints: it cannot hand you the fingerprint, but WebAuthn gives
-- cryptographic proof that the phone's own biometric was satisfied, which is
-- the part that actually matters.

-- How far from the shop still counts as "at work". Phone GPS in a dense street
-- is routinely 30-60m out, so the default is loose enough not to punish someone
-- standing at the door.
alter table public.stores
  add column if not exists clock_radius_m integer not null default 150;

-- One row per registered phone. The public key is public by definition; the
-- private half never leaves the device and is gated by its own fingerprint.
create table if not exists public.employee_devices (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.store_employees(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists employee_devices_employee_idx
  on public.employee_devices (employee_id);

-- A short-lived code the owner reads out once, to attach a phone to a person.
-- Six digits and ten minutes: long enough to walk across the shop, short enough
-- that a code overheard yesterday is worthless.
create table if not exists public.employee_enrolments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.store_employees(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists employee_enrolments_lookup_idx
  on public.employee_enrolments (store_id, code) where used_at is null;

-- Challenges must be issued and spent server-side; a replayed assertion is the
-- whole attack WebAuthn exists to stop.
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  challenge text not null unique,
  purpose text not null check (purpose in ('register', 'authenticate')),
  employee_id uuid references public.store_employees(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webauthn_challenges_expiry_idx
  on public.webauthn_challenges (expires_at);

alter table public.employee_devices enable row level security;
alter table public.employee_enrolments enable row level security;
alter table public.webauthn_challenges enable row level security;

-- All three are written only by the service role from route handlers. The owner
-- may look at which phones are registered, and nothing else is readable.
drop policy if exists employee_devices_read on public.employee_devices;
create policy employee_devices_read on public.employee_devices
  for select using (public.can_manage_store(store_id) or public.is_super_admin());

drop policy if exists employee_devices_delete on public.employee_devices;
create policy employee_devices_delete on public.employee_devices
  for delete using (public.can_manage_store(store_id) or public.is_super_admin());

drop policy if exists employee_enrolments_read on public.employee_enrolments;
create policy employee_enrolments_read on public.employee_enrolments
  for select using (public.can_manage_store(store_id) or public.is_super_admin());

create or replace function public.create_enrolment_code(p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_store uuid;
  v_code text;
begin
  select store_id into v_store from public.store_employees where id = p_employee_id;
  if v_store is null then raise exception 'employee_not_found'; end if;
  if not (public.can_manage_store(v_store) or public.is_super_admin()) then
    raise exception 'not_authorized';
  end if;

  update public.employee_enrolments set used_at = now()
  where employee_id = p_employee_id and used_at is null;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.employee_enrolments (employee_id, store_id, code, expires_at)
  values (p_employee_id, v_store, v_code, now() + interval '10 minutes');

  return v_code;
end
$function$;

revoke all on function public.create_enrolment_code(uuid) from public, anon;
grant execute on function public.create_enrolment_code(uuid) to authenticated;

-- Distance in metres between two points. Haversine on a sphere is accurate to
-- well under a metre at shop distances, which is far better than the GPS fix.
create or replace function public.meters_between(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns numeric
language sql
immutable
as $function$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$function$;

-- The punch itself, once a route handler has verified the phone's signature.
-- Distance is enforced HERE rather than in the browser: a client that decides
-- whether it is close enough is a client that can lie about it.
create or replace function public.clock_by_device(
  p_credential_id text,
  p_lat numeric,
  p_lng numeric
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
  v_dist numeric;
begin
  select * into v_dev from public.employee_devices where credential_id = p_credential_id;
  if not found then raise exception 'device_not_registered'; end if;

  select * into v_emp from public.store_employees where id = v_dev.employee_id;
  if v_emp.status <> 'active' then raise exception 'employee_not_active'; end if;

  select * into v_store from public.stores where id = v_dev.store_id;

  -- No pin on the map means there is nothing to be near. Refusing loudly beats
  -- accepting every punch from anywhere and calling it verified.
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

  update public.employee_devices set last_used_at = now() where id = v_dev.id;

  select * into v_open from public.employee_attendance
  where employee_id = v_emp.id and checked_out_at is null;

  if found then
    update public.employee_attendance set checked_out_at = now() where id = v_open.id;
    return jsonb_build_object('action', 'out', 'name', v_emp.name, 'meters', round(v_dist));
  end if;

  insert into public.employee_attendance
    (store_id, employee_id, work_date, source, lat, lng)
  values (v_dev.store_id, v_emp.id,
          (now() at time zone 'Asia/Beirut')::date, 'device', p_lat, p_lng);

  return jsonb_build_object('action', 'in', 'name', v_emp.name, 'meters', round(v_dist));
end
$function$;

revoke all on function public.clock_by_device(text, numeric, numeric) from public, anon, authenticated;
