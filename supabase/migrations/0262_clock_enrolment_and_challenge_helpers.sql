-- Helpers the route handlers call with the service role, kept in SQL so the
-- rules live next to the data rather than in whichever handler ran last.

-- What a phone standing outside the shop is allowed to know before anyone has
-- proved anything: the shop's name, and whether clocking in can work at all.
-- Deliberately no roster — the previous version handed the staff list to any
-- passer-by holding a store id.
create or replace function public.clock_store_context(p_short_code text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select case when s.id is null then null else jsonb_build_object(
    'store_id', s.id,
    'name', s.name,
    'has_location', (s.lat is not null and s.lng is not null),
    'radius', s.clock_radius_m
  ) end
  from public.stores s
  where lower(s.short_code) = lower(btrim(p_short_code))
    and s.deleted_at is null
  limit 1;
$function$;

grant execute on function public.clock_store_context(text) to anon, authenticated;

-- Spend an enrolment code and say who it belonged to. One shot: the code is
-- marked used before the device is written, so a code that leaked is worth one
-- race at worst rather than an unlimited supply of registrations.
create or replace function public.redeem_enrolment_code(
  p_store_id uuid,
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_id uuid; v_emp uuid;
begin
  select id, employee_id into v_id, v_emp
  from public.employee_enrolments
  where store_id = p_store_id
    and code = btrim(p_code)
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_id is null then raise exception 'bad_code'; end if;

  update public.employee_enrolments set used_at = now() where id = v_id;
  return v_emp;
end
$function$;

revoke all on function public.redeem_enrolment_code(uuid, text) from public, anon, authenticated;

-- Issue a challenge, and spend it. A challenge that can be replayed is the one
-- thing that would make all of this decorative.
create or replace function public.issue_webauthn_challenge(
  p_store_id uuid,
  p_purpose text,
  p_challenge text,
  p_employee_id uuid default null
)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public.webauthn_challenges
    (store_id, purpose, challenge, employee_id, expires_at)
  values (p_store_id, p_purpose, p_challenge, p_employee_id, now() + interval '5 minutes');
$function$;

create or replace function public.spend_webauthn_challenge(
  p_challenge text,
  p_purpose text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_id uuid; v_emp uuid;
begin
  select id, employee_id into v_id, v_emp
  from public.webauthn_challenges
  where challenge = p_challenge
    and purpose = p_purpose
    and used_at is null
    and expires_at > now()
  for update;

  if v_id is null then raise exception 'bad_challenge'; end if;

  update public.webauthn_challenges set used_at = now() where id = v_id;
  -- Housekeeping on the way past, so the table never needs a cron.
  delete from public.webauthn_challenges where expires_at < now() - interval '1 day';
  return v_emp;
end
$function$;

revoke all on function public.issue_webauthn_challenge(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.spend_webauthn_challenge(text, text) from public, anon, authenticated;

create or replace function public.register_employee_device(
  p_employee_id uuid,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_store uuid; v_id uuid;
begin
  select store_id into v_store from public.store_employees where id = p_employee_id;
  if v_store is null then raise exception 'employee_not_found'; end if;

  insert into public.employee_devices
    (employee_id, store_id, credential_id, public_key, counter, label)
  values (p_employee_id, v_store, p_credential_id, p_public_key, p_counter, p_label)
  on conflict (credential_id) do update
    set employee_id = excluded.employee_id,
        store_id = excluded.store_id,
        public_key = excluded.public_key,
        counter = excluded.counter,
        label = excluded.label
  returning id into v_id;
  return v_id;
end
$function$;

revoke all on function public.register_employee_device(uuid, text, text, bigint, text) from public, anon, authenticated;
